// ==============================================================================
// AssetVault: User Management Page (Tenant Administration)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Role assignments, user provisioning, credential reset, and activation status
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import { User, RoleName } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { Pagination } from '../../components/common/Pagination';

export const UserListPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<{
    email: string;
    fullName: string;
    password: string;
    roleName: RoleName;
  }>({
    email: '',
    fullName: '',
    password: '',
    roleName: 'MEMBER',
  });

  const [newRole, setNewRole] = useState<RoleName>('MEMBER');
  const [newPassword, setNewPassword] = useState('');

  // Fetch Users
  const { data: usersData, isLoading } = useQuery<{
    data: User[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['users', page, limit, search, roleFilter, statusFilter],
    queryFn: async () => {
      const res = await api.get<{ data: User[]; meta: any }>('/users', {
        params: {
          page,
          limit,
          q: search || undefined,
          role: roleFilter || undefined,
          isActive: statusFilter || undefined,
        },
      });
      return res;
    },
  });

  // MUTATIONS
  // Create User
  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.post('/users', data),
    onSuccess: () => {
      toast({ title: 'User Invited', message: 'User provisioned successfully', type: 'success' });
      setIsCreateOpen(false);
      setCreateForm({ email: '', fullName: '', password: '', roleName: 'MEMBER' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to create user', type: 'error' });
    },
  });

  // Change Role
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: RoleName }) =>
      api.patch(`/users/${userId}/role`, { roleName }),
    onSuccess: () => {
      toast({ title: 'Role Updated', message: 'User role updated successfully', type: 'success' });
      setEditRoleUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to change role', type: 'error' });
    },
  });

  // Toggle Status (Activate / Deactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/users/${userId}/status`, { isActive }),
    onSuccess: (_, vars) => {
      toast({
        title: vars.isActive ? 'User Activated' : 'User Deactivated',
        message: `Account status updated successfully`,
        type: 'info',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to update user status', type: 'error' });
    },
  });

  // Reset Password
  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.post(`/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast({ title: 'Password Reset', message: 'User password reset successfully', type: 'success' });
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to reset password', type: 'error' });
    },
  });

  // Delete User
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      toast({ title: 'User Deleted', message: 'User removed from tenant organization', type: 'info' });
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to delete user', type: 'error' });
    },
  });

  const usersList = usersData?.data || [];
  const meta = usersData?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Organization Users & Roles
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage organization members, role-based authorization, and account security.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          Add User
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by name or email..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Roles</option>
            <option value="TENANT_ADMIN">Tenant Admin</option>
            <option value="ASSET_MANAGER">Asset Manager</option>
            <option value="MEMBER">Member</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table / Mobile Cards */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : usersList.length === 0 ? (
        <EmptyState
          title="No Users Found"
          message="No organization users match the selected criteria."
          action={{
            label: 'Add First User',
            onClick: () => setIsCreateOpen(true),
          }}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs uppercase">
                          {u.fullName.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{u.fullName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          u.role === 'TENANT_ADMIN'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                            : u.role === 'ASSET_MANAGER'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'SUSPENDED'} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Change Role Button */}
                        <button
                          onClick={() => {
                            setEditRoleUser(u);
                            setNewRole(u.role);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          title="Change Role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => setResetPasswordUser(u)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Status Toggle Button */}
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                userId: u.id,
                                isActive: !u.isActive,
                              })
                            }
                            className={`p-1.5 rounded transition-colors ${
                              u.isActive
                                ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={u.isActive ? 'Deactivate User' : 'Activate User'}
                          >
                            {u.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {/* Delete User Button */}
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View (< 640px) */}
          <div className="block sm:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {usersList.map((u) => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs uppercase">
                      {u.fullName.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-xs">{u.fullName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={u.isActive ? 'ACTIVE' : 'SUSPENDED'} size="sm" />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Role: {u.role}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setEditRoleUser(u);
                        setNewRole(u.role);
                      }}
                      className="text-primary-600 font-medium"
                    >
                      Role
                    </button>
                    <button
                      onClick={() => setResetPasswordUser(u)}
                      className="text-slate-600 dark:text-slate-300 font-medium"
                    >
                      Password
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Server-Side Pagination */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Provision New Organization User">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(createForm);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Jane Doe"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="jane@company.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Initial Password</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Role Assignment</label>
            <select
              value={createForm.roleName}
              onChange={(e) => setCreateForm({ ...createForm, roleName: e.target.value as RoleName })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="MEMBER">Member (Standard access & checkout)</option>
              <option value="ASSET_MANAGER">Asset Manager (Manage assets & licenses)</option>
              <option value="TENANT_ADMIN">Tenant Admin (Full organization authority)</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHANGE ROLE MODAL */}
      <Modal isOpen={!!editRoleUser} onClose={() => setEditRoleUser(null)} title="Update User Role">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Modifying authorization role for <span className="font-bold">{editRoleUser?.fullName}</span>.
          </p>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">New Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as RoleName)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="MEMBER">Member</option>
              <option value="ASSET_MANAGER">Asset Manager</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditRoleUser(null)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={changeRoleMutation.isPending}
              onClick={() =>
                changeRoleMutation.mutate({
                  userId: editRoleUser!.id,
                  roleName: newRole,
                })
              }
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {changeRoleMutation.isPending ? 'Updating...' : 'Update Role'}
            </button>
          </div>
        </div>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal isOpen={!!resetPasswordUser} onClose={() => setResetPasswordUser(null)} title="Administrative Password Reset">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Set a new temporary password for <span className="font-bold">{resetPasswordUser?.fullName}</span>.
          </p>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">New Password</label>
            <input
              type="password"
              minLength={8}
              required
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setResetPasswordUser(null)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
              onClick={() =>
                resetPasswordMutation.mutate({
                  userId: resetPasswordUser!.id,
                  newPassword,
                })
              }
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50"
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE USER CONFIRMATION */}
      <ConfirmDialog
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteMutation.mutate(deleteUser!.id)}
        title="Remove User"
        message={`Are you sure you want to permanently remove "${deleteUser?.fullName}" from your tenant organization? All active seat allocations will be released.`}
        confirmText="Remove User"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
