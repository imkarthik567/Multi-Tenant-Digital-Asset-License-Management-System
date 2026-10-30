import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Search,
  Bell,
  Menu,
  LogOut,
  Settings,
  CheckCheck,
  X,
  ArrowRight,
} from 'lucide-react';

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/assets': 'Assets',
  '/licenses': 'Licenses',
  '/my-licenses': 'My Licenses',
  '/allocations': 'Allocations',
  '/vendors': 'Vendors',
  '/categories': 'Categories',
  '/tags': 'Metadata Tags',
  '/reports': 'Analytics',
  '/users': 'Team',
  '/audit': 'Audit Trail',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/ai-assistant': 'Copilot',
};

const QUICK_JUMP_ITEMS = [
  { label: 'Overview', path: '/', roles: ['TENANT_ADMIN', 'ASSET_MANAGER', 'MEMBER'] },
  { label: 'Assets', path: '/assets', roles: ['TENANT_ADMIN', 'ASSET_MANAGER', 'MEMBER'] },
  { label: 'My Licenses', path: '/my-licenses', roles: ['MEMBER'] },
  { label: 'Licenses', path: '/licenses', roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
  { label: 'Allocations', path: '/allocations', roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
  { label: 'Vendors', path: '/vendors', roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
  { label: 'Analytics', path: '/reports', roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
  { label: 'Team', path: '/users', roles: ['TENANT_ADMIN'] },
  { label: 'Settings', path: '/settings', roles: ['TENANT_ADMIN', 'ASSET_MANAGER', 'MEMBER'] },
];

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);

  const pageTitle = ROUTE_TITLES[location.pathname] || 'Workspace';
  const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name || 'MEMBER';

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const payload = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(payload) ? payload : payload.notifications || [];
      setNotifications(list.slice(0, 12));
      setUnreadCount(list.filter((n: any) => !n.is_read && !n.isRead).length);
    } catch {
      // ignore background polling error
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 45000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const initials = (user?.fullName || user?.email || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const filteredLinks = QUICK_JUMP_ITEMS.filter(
    (item) =>
      item.roles.includes(userRole) &&
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-[#060913]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Mobile Menu & Clean Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span className="text-sm font-semibold text-white truncate">{pageTitle}</span>
        </div>

        {/* Center: Minimalist Search Bar */}
        <div className="flex-1 max-w-sm mx-auto hidden md:block">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-slate-400 hover:text-slate-200 transition-all text-xs"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Search workspace...</span>
            </span>
            <kbd className="text-[10px] font-mono text-slate-500">⌘K</kbd>
          </button>
        </div>

        {/* Right: Minimalist Actions (Search on mobile, Notifications, Profile) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </button>

          {/* Clean User Avatar Button */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white">
                {initials}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-slate-200 max-w-[120px] truncate pr-1">
                {user?.fullName || 'Account'}
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0b1120] border border-white/[0.08] shadow-2xl py-1.5 z-50">
                <div className="px-3.5 py-2 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.fullName || 'Workspace User'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {user?.email}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings</span>
                  </button>
                </div>

                <div className="border-t border-white/[0.06] pt-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Command Palette Modal (⌘K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-[#0b1120] border border-white/[0.1] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to page..."
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded bg-white/[0.05]"
              >
                ESC
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
              {filteredLinks.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    navigate(item.path);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
              {filteredLinks.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  No matching views found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Slide-Over Drawer */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setNotifOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm bg-[#090e1c] border-l border-white/[0.08] h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark read</span>
                  </button>
                )}
                <button
                  onClick={() => setNotifOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No workspace alerts.
                </div>
              ) : (
                notifications.map((n, idx) => {
                  const isRead = n.is_read || n.isRead;
                  return (
                    <div
                      key={n.notification_id || n.id || `notif-${idx}`}
                      className={`p-4 transition-colors ${isRead ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-white">
                          {n.title || n.notification_type || 'Alert'}
                        </p>
                        {!isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
