import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { Building2, Users2, Plus, CheckCircle, AlertCircle, X } from 'lucide-react';

export const TenantSettingsPage: React.FC = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    roleName: 'member',
  });
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  // Fetch tenant members
  const { data: usersData, isLoading } = useQuery<{ data: User[] }>({
    queryKey: ['tenant-users'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
  });

  // Invite user mutation
  const inviteMutation = useMutation({
    mutationFn: (newMember: any) => api.post('/users', newMember),
    onSuccess: () => {
      setShowInviteModal(false);
      setInviteForm({ fullName: '', email: '', roleName: 'member' });
      setNotice({ text: 'Team member added successfully.' });
      setTimeout(() => setNotice(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (err: any) => {
      setNotice({ text: err.message || 'Failed to add user.', error: true });
    },
  });

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      api.patch(`/users/${userId}`, { roleName }),
    onSuccess: () => {
      setNotice({ text: 'User role updated.' });
      setTimeout(() => setNotice(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate(inviteForm);
  };

  const users = usersData?.data || [];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Organization Profile & Team</h1>
        <p className="text-xs text-slate-400 mt-1">
          Tenant organization workspace parameters, subscription status, and role assignments.
        </p>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
            notice.error
              ? 'bg-red-950/60 border-red-800 text-red-300'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}
        >
          {notice.error ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Organization Details Card */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{tenant?.name}</h2>
            <p className="text-xs text-slate-400 font-mono">Workspace Slug: {tenant?.slug}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block">Subscription Tier</span>
            <span className="font-bold text-white capitalize">{tenant?.subscriptionTier}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Tenant Status</span>
            <span className="font-bold text-emerald-400 capitalize">{tenant?.status}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Isolation Architecture</span>
            <span className="font-bold text-slate-300">Row-Level RLS + 3NF</span>
          </div>
        </div>
      </div>

      {/* Team Roster */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Users2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-white">Team Members ({users.length})</h2>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {users.map((member) => (
              <div
                key={member.id}
                className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
              >
                <div className="flex items-center space-x-3">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                      {member.fullName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-white text-xs">{member.fullName}</p>
                    <p className="text-[11px] text-slate-400">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      updateRoleMutation.mutate({ userId: member.id, roleName: e.target.value })
                    }
                    className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none capitalize font-medium"
                  >
                    <option value="tenant_admin">Tenant Admin</option>
                    <option value="asset_manager">Asset Manager</option>
                    <option value="member">Member</option>
                    <option value="auditor">Auditor</option>
                  </select>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      member.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {member.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-white mb-4">Add Team Member</h3>

            <form onSubmit={handleInviteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  required
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="e.g. Jordan Lee"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="jordan.lee@acme.io"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role Assignment</label>
                <select
                  value={inviteForm.roleName}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none capitalize"
                >
                  <option value="member">Member (Asset User)</option>
                  <option value="asset_manager">Asset Manager</option>
                  <option value="tenant_admin">Tenant Administrator</option>
                  <option value="auditor">Auditor (Compliance)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
                >
                  {inviteMutation.isPending ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
