import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutGrid,
  FolderOpen,
  Key,
  UserCheck,
  Building2,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Compass,
  Shield,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);

  const isExpanded = !isCollapsed || hovered;
  const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name || 'MEMBER';

  const navItems: NavItem[] = [
    { label: 'Overview', to: '/', icon: LayoutGrid },
    { label: 'Assets', to: '/assets', icon: FolderOpen },
    { label: 'My Licenses', to: '/my-licenses', icon: Compass, roles: ['MEMBER'] },
    { label: 'Licenses', to: '/licenses', icon: Key, roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
    { label: 'Allocations', to: '/allocations', icon: UserCheck, roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
    { label: 'Vendors', to: '/vendors', icon: Building2, roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
    { label: 'Analytics', to: '/reports', icon: BarChart3, roles: ['TENANT_ADMIN', 'ASSET_MANAGER'] },
    { label: 'Team', to: '/users', icon: Users, roles: ['TENANT_ADMIN'] },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        onMouseEnter={() => isCollapsed && setHovered(true)}
        onMouseLeave={() => isCollapsed && setHovered(false)}
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 flex flex-col shrink-0 h-screen bg-[#060913] border-r border-white/[0.06] transition-all duration-300 ease-out select-none ${
          isExpanded ? 'w-56' : 'w-[68px]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Minimal Brand Header */}
        <div className="h-14 px-4 flex items-center border-b border-white/[0.05]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            {isExpanded && (
              <span className="text-sm font-bold tracking-tight text-white">
                AssetVault
              </span>
            )}
          </div>
        </div>

        {/* Single Minimalist Navigation List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1 scrollbar-none">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-indigo-400'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Minimal Collapse Toggle */}
        <div className="p-2.5 border-t border-white/[0.05] hidden lg:block">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="flex-1 text-left">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
