// ==============================================================================
// AssetVault: Organization & User Account Settings
// Course: BCSE307L Database Systems (Fall 2026-27)
// Profile settings, tenant workspace info, and session security
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  User as UserIcon,
  Shield,
  LogOut,
  Download,
  Database,
  Edit3,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

export const TenantSettingsPage: React.FC = () => {
  const { user, tenant, logout, hasPermission, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const canExportTenant = hasPermission('tenants:update_own');
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'organization' | 'security'>('profile');
  const [isLogoutAllOpen, setIsLogoutAllOpen] = useState(false);
  const [isExportingTenant, setIsExportingTenant] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: { fullName: string; email: string }) =>
      api.patch('/users/me/profile', payload),
    onSuccess: async (_, vars) => {
      toast({
        title: 'Profile & Email Updated',
        message: `Automated workspace notifications and license alerts will now be sent to ${vars.email}.`,
        type: 'success',
      });
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      try {
        await refreshProfile();
      } catch {}
    },
    onError: (err: any) => {
      toast({
        title: 'Update Failed',
        message: err.message || 'Could not update your email address.',
        type: 'error',
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = profileForm.email.trim().toLowerCase();
    const trimmedName = profileForm.fullName.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        type: 'error',
      });
      return;
    }
    updateProfileMutation.mutate({
      fullName: trimmedName || user?.fullName || 'User',
      email: trimmedEmail,
    });
  };

  const handleExportTenantData = async () => {
    setIsExportingTenant(true);
    try {
      const response = await api.get('/tenant/export');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(response, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `tenant-archive-${tenant?.slug || 'export'}-${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast({
        title: 'Tenant Archive Exported',
        message: 'Full GDPR & compliance JSON archive generated successfully.',
        type: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        message: err.message || 'Failed to generate tenant export archive.',
        type: 'error',
      });
    } finally {
      setIsExportingTenant(false);
    }
  };

  // Logout All Devices Mutation (POST /api/auth/logout-all)
  const logoutAllMutation = useMutation({
    mutationFn: () => api.post('/auth/logout-all', {}),
    onSuccess: async () => {
      toast({
        title: 'Sessions Revoked',
        message: 'All active refresh tokens revoked. Please log in again.',
        type: 'info',
      });
      await logout();
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        message: err.message || 'Failed to revoke active sessions.',
        type: 'error',
      });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your profile, workspace preferences, and session security.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.07]">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-1 border-b-2 text-xs font-medium transition-colors flex items-center cursor-pointer ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 mr-1.5" />
            Profile
          </button>

          {!user?.isSuperAdmin && (
            <button
              onClick={() => setActiveTab('organization')}
              className={`py-3 px-1 border-b-2 text-xs font-medium transition-colors flex items-center cursor-pointer ${
                activeTab === 'organization'
                  ? 'border-indigo-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building className="w-3.5 h-3.5 mr-1.5" />
              Workspace
            </button>
          )}

          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-1 border-b-2 text-xs font-medium transition-colors flex items-center cursor-pointer ${
              activeTab === 'security'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Security
          </button>
        </nav>
      </div>

      {/* TAB 1: USER PROFILE */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-xl bg-[#0b1120] border border-white/[0.07] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 flex items-center justify-center font-bold text-sm uppercase">
                {user?.fullName?.slice(0, 2) || 'AV'}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{user?.fullName}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                <div className="mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                    {typeof user?.role === 'object' && user?.role !== null ? (user.role as any).name : user?.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isEditingProfile ? 'Cancel' : 'Edit Profile'}</span>
              </button>
            </div>
          </div>

          {isEditingProfile && (
            <form
              onSubmit={handleProfileSubmit}
              className="p-4 rounded-xl bg-slate-950/60 border border-white/[0.08] space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0b1120] text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0b1120] text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: ORGANIZATION WORKSPACE */}
      {activeTab === 'organization' && !user?.isSuperAdmin && (
        <div className="p-6 rounded-xl bg-[#0b1120] border border-white/[0.07] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">{tenant?.name || 'Organization'}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {tenant?.slug || 'default'}
              </p>
            </div>
            <StatusBadge status={tenant?.status || 'ACTIVE'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06] text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Subscription Plan</span>
              <span className="font-semibold text-white">
                {tenant?.plan?.name || `Enterprise`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Contact Email</span>
              <span className="text-slate-200">{tenant?.contactEmail || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Created</span>
              <span className="text-slate-200">
                {tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Data Lifecycle / GDPR Archive Section */}
          {canExportTenant && (
            <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  Workspace Data Archive
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Download a complete JSON export of organization assets, licenses, and allocations.
                </p>
              </div>
              <button
                onClick={handleExportTenantData}
                disabled={isExportingTenant}
                className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-slate-200 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                {isExportingTenant ? 'Exporting...' : 'Export Archive'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSION SECURITY */}
      {activeTab === 'security' && (
        <div className="p-6 rounded-xl bg-[#0b1120] border border-white/[0.07] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Active Device Sessions</h4>
              <p className="text-xs text-slate-400 mt-1">
                Sign out of all active sessions across every browser and device.
              </p>
            </div>
            <button
              onClick={() => setIsLogoutAllOpen(true)}
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-500 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out All Devices
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM LOGOUT ALL */}
      <ConfirmDialog
        isOpen={isLogoutAllOpen}
        onClose={() => setIsLogoutAllOpen(false)}
        onConfirm={() => logoutAllMutation.mutate()}
        title="Revoke All Active Sessions"
        message="Are you sure you want to log out of all active sessions across every device? You will be returned to the login screen immediately."
        confirmText="Revoke All Sessions"
        variant="danger"
        isLoading={logoutAllMutation.isPending}
      />
    </div>
  );
};
