import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FolderArchive,
  KeyRound,
  Users2,
  Building,
  FolderTree,
  Tags,
  ScrollText,
  Settings,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const navItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'Digital Assets', to: '/assets', icon: FolderArchive },
    { label: 'Licenses & Quotas', to: '/licenses', icon: KeyRound },
    { label: 'Seat Allocations', to: '/allocations', icon: Users2 },
    { label: 'Vendors', to: '/vendors', icon: Building },
    { label: 'Categories', to: '/categories', icon: FolderTree },
    { label: 'Tags', to: '/tags', icon: Tags },
  ];

  // Restrict audit trails to Admin / Auditor
  const isAdminOrAuditor = user?.role === 'tenant_admin' || user?.role === 'auditor' || user?.isSuperAdmin;
  const isTenantAdmin = user?.role === 'tenant_admin' || user?.isSuperAdmin;

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between p-4">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Operations
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Governance & Settings
          </p>
          <nav className="space-y-1">
            {isAdminOrAuditor && (
              <NavLink
                to="/audit-logs"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <ScrollText className="w-4 h-4" />
                <span>Audit Trails</span>
              </NavLink>
            )}

            {isTenantAdmin && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <Settings className="w-4 h-4" />
                <span>Team & Settings</span>
              </NavLink>
            )}
          </nav>
        </div>
      </div>

      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-500">
        <p className="font-semibold text-slate-400">AssetVault SaaS</p>
        <p className="text-[10px] mt-0.5">VIT BCSE307L DBMS Project</p>
      </div>
    </aside>
  );
};
