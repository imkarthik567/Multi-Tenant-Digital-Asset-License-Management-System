// ==============================================================================
// AssetVault: Top Navigation Bar
// Course: BCSE307L Database Systems (Fall 2026-27)
// Tenant badge, live 60s notification polling, theme toggle, and user profile menu
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Settings,
  Shield,
  Building2,
  CheckCheck,
  ChevronDown,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { CommandPalette } from '../common/CommandPalette';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Notification } from '../../types';

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuToggle }) => {
  const { user, tenant, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const userRole = typeof user?.role === 'object' && user?.role !== null ? (user.role as any).name : user?.role;

  // Global Ctrl+K / Cmd+K hotkey for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time Server-Sent Events (SSE) notification stream listener
  useEffect(() => {
    if (!user) return;
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/notifications/stream', { withCredentials: true });
      eventSource.addEventListener('notification', (e) => {
        try {
          const payload = JSON.parse(e.data);
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.info(payload.message || 'New notification alert');
        } catch {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      });
      eventSource.onerror = () => {
        // EventSource will automatically retry in the background
      };
    } catch {
      // Fallback cleanly to polling
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [user, queryClient, toast]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll Notifications every 60 seconds
  const { data: notifData } = useQuery<Notification[]>({
    queryKey: ['notifications', 'navbar'],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[] }>('/notifications', { limit: 5 });
      return res.data;
    },
    refetchInterval: 60000,
    enabled: !!user,
  });

  const unreadCount = notifData?.filter((n: Notification) => !n.isRead).length || 0;

  // Mark all notifications read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('You have been logged out');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'AV';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Toggle & Tenant Branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[160px] sm:max-w-xs">
                {user?.isSuperAdmin ? 'AssetVault Platform' : tenant?.name || 'AssetVault'}
              </span>
              {tenant && !user?.isSuperAdmin && (
                <StatusBadge status={tenant.status} size="sm" />
              )}
            </div>
            {tenant?.plan && (
              <span className="text-[10px] uppercase font-semibold tracking-wider text-primary-600 dark:text-primary-400 block -mt-0.5">
                {tenant.plan.name} Tier
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Command Palette Trigger Button (Desktop & Tablet) */}
      <button
        type="button"
        onClick={() => setIsSearchOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg border border-slate-200 dark:border-slate-700/60 transition-all w-56 lg:w-72 justify-between"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">Search workspace...</span>
        </span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded shadow-xs shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Right: Actions (Theme Toggle, Notifications Bell, Profile Menu) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          aria-label="Open command search"
          className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Dark/Light Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Live Notification Bell with Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            type="button"
            onClick={() => setIsNotifDropdownOpen((prev) => !prev)}
            aria-label="Notifications"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {isNotifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Notifications ({unreadCount} new)
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-850">
                {notifData && notifData.length > 0 ? (
                  notifData.map((n: Notification) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-850 ${
                        !n.isRead ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                )}
              </div>

              <div className="p-2 text-center bg-slate-50/50 dark:bg-slate-900/50">
                <Link
                  to="/notifications"
                  onClick={() => setIsNotifDropdownOpen(false)}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline block py-1"
                >
                  View all notifications &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Menu Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="User profile menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 border border-primary-200 dark:border-primary-800/80 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-xs">
              {getInitials(user?.fullName)}
            </div>
            <div className="hidden sm:block text-left text-xs leading-tight">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[120px]">
                {user?.fullName}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-medium">
                {userRole?.replace('_', ' ')}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <div className="p-3">
                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user?.fullName}
                </p>
                <p className="text-slate-400 truncate mt-0.5">{user?.email}</p>
                <div className="mt-2">
                  <StatusBadge status={userRole} size="sm" />
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile & Password</span>
                </Link>
                {userRole === 'TENANT_ADMIN' && (
                  <Link
                    to="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Organization Settings</span>
                  </Link>
                )}
                {user?.isSuperAdmin && (
                  <Link
                    to="/platform/tenants"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Platform Admin</span>
                  </Link>
                )}
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Multi-Entity Command Palette Modal */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
};
