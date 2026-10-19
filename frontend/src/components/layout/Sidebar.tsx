// ==============================================================================
// AssetVault: Collapsible Sidebar & Mobile Drawer Navigation
// Course: BCSE307L Database Systems (Fall 2026-27)
// Merges GET /api/auth/menu with client-side RBAC permission gating
// ==============================================================================

import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderLock,
  KeyRound,
  Layers,
  Users,
  Store,
  FolderTree,
  Tag as TagIcon,
  Bell,
  FileSpreadsheet,
  History,
  Settings,
  Shield,
  Building,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}) => {
  const { user, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  // Static navigation schema with strict RBAC gate rules
  const baseNavigation: NavItem[] = useMemo(() => {
    if (user?.isSuperAdmin) {
      return [
        { id: 'dashboard', label: 'Platform Overview', path: '/', icon: <Shield className="w-5 h-5" /> },
        { id: 'tenants', label: 'Tenants', path: '/platform/tenants', icon: <Building className="w-5 h-5" />, permission: 'tenants:read_platform' },
        { id: 'plans', label: 'Subscription Plans', path: '/platform/plans', icon: <CreditCard className="w-5 h-5" />, permission: 'plans:read' },
        { id: 'notifications', label: 'Notifications', path: '/notifications', icon: <Bell className="w-5 h-5" /> },
        { id: 'settings', label: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> },
      ];
    }

    const items: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
      { id: 'assets', label: 'Digital Assets', path: '/assets', icon: <FolderLock className="w-5 h-5" />, permission: 'assets:read' },
    ];

    const roleName =
      typeof user?.role === 'object' && user?.role !== null
        ? (user.role as any).name
        : user?.role;

    // For standard members: My Licenses
    if (roleName === 'MEMBER') {
      items.push({ id: 'my_licenses', label: 'My Licenses', path: '/my-licenses', icon: <Compass className="w-5 h-5" /> });
    }

    // For Asset Managers & Tenant Admins
    if (roleName === 'TENANT_ADMIN' || roleName === 'ASSET_MANAGER') {
      items.push(
        { id: 'licenses', label: 'Licenses', path: '/licenses', icon: <KeyRound className="w-5 h-5" />, permission: 'licenses:read' },
        { id: 'allocations', label: 'Seat Allocations', path: '/allocations', icon: <Layers className="w-5 h-5" />, permission: 'allocations:read' },
        { id: 'vendors', label: 'Vendors', path: '/vendors', icon: <Store className="w-5 h-5" />, permission: 'vendors:read' },
        { id: 'categories', label: 'Categories', path: '/categories', icon: <FolderTree className="w-5 h-5" />, permission: 'categories:read' },
        { id: 'tags', label: 'Metadata Tags', path: '/tags', icon: <TagIcon className="w-5 h-5" />, permission: 'tags:read' },
        { id: 'reports', label: 'Analytical Reports', path: '/reports', icon: <FileSpreadsheet className="w-5 h-5" /> }
      );
    }

    // For Tenant Admins strictly: Users and Audit Ledger
    if (roleName === 'TENANT_ADMIN') {
      items.push(
        { id: 'users', label: 'Users & Roles', path: '/users', icon: <Users className="w-5 h-5" />, permission: 'users:read' },
        { id: 'audit_logs', label: 'Audit Trail', path: '/audit-logs', icon: <History className="w-5 h-5" />, permission: 'audit:read' }
      );
    }

    items.push(
      { id: 'notifications', label: 'Notifications', path: '/notifications', icon: <Bell className="w-5 h-5" /> },
      { id: 'settings', label: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> }
    );

    return items;
  }, [user]);

  // Merge server-driven menu if available and filter with permission rules
  const visibleItems = useMemo(() => {
    return baseNavigation.filter((item) => {
      if (item.roles && !hasRole(item.roles as any)) return false;
      if (item.permission && !hasPermission(item.permission)) return false;
      return true;
    });
  }, [baseNavigation, hasPermission, hasRole]);

  const navContent = (
    <div className="flex flex-col h-full bg-slate-900 dark:bg-slate-950 text-slate-300 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-black text-base shadow-md">
            AV
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-white">
                AssetVault
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                Enterprise SaaS
              </span>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        {isMobileOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={isMobileOpen ? onMobileClose : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title={isCollapsed && !isMobileOpen ? item.label : undefined}
            >
              <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                {item.icon}
              </span>
              {(!isCollapsed || isMobileOpen) && (
                <span className="truncate">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Desktop Collapse Toggle */}
      <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-800 shrink-0">
        {(!isCollapsed || isMobileOpen) && (
          <span className="text-[11px] text-slate-500 font-medium">
            Collapse sidebar
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-auto"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar Rail / Expanded Panel */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="fixed top-0 bottom-0 z-40 w-inherit">
          {navContent}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] flex-1 z-50 animate-slide-in">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
