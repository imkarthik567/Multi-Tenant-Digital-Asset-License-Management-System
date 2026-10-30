import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Search,
  X,
  Check,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Edit3,
  ArrowRightLeft,
} from 'lucide-react';
import { api } from '../../services/api';
import { User, RoleName } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Button,
  Avatar,
  Input,
  Select,
  Skeleton,
} from '../../components/ui';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { GmailSenderBanner } from '../../components/notifications/GmailSenderBanner';

export const ROLE_CONFIG: Record<
  RoleName,
  {
    label: string;
    description: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Global system supervisor with root authority',
    badgeClass: 'bg-purple-950/50 text-purple-300 border-purple-800/50',
    dotClass: 'bg-purple-400',
  },
  TENANT_ADMIN: {
    label: 'Admin',
    description: 'Sole workspace owner with full authority over members, policies & billing',
    badgeClass: 'bg-indigo-950/50 text-indigo-300 border-indigo-800/50',
    dotClass: 'bg-indigo-400',
  },
  ASSET_MANAGER: {
    label: 'Asset Manager',
    description: 'Manage digital assets, metadata and license seats',
    badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-800/50',
    dotClass: 'bg-sky-400',
  },
  MEMBER: {
    label: 'Member',
    description: 'Standard access to browse assets and use assigned licenses',
    badgeClass: 'bg-white/[0.04] text-slate-300 border-white/[0.08]',
    dotClass: 'bg-slate-400',
  },
};

export const TENANT_ASSIGNABLE_ROLES: RoleName[] = [
  'TENANT_ADMIN',
  'ASSET_MANAGER',
  'MEMBER',
];

export function getRoleName(role: any): RoleName {
  if (!role) return 'MEMBER';
  if (typeof role === 'string') return role as RoleName;
  if (typeof role === 'object' && role.name) return role.name as RoleName;
  return 'MEMBER';
}

export function generateSecurePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const parts = [
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
    pick(lower),
    pick(upper),
  ];
  return parts.sort(() => 0.5 - Math.random()).join('');
}

export function extractValidEmailsFromText(raw: string): string[] {
  const matches = (raw || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const m of matches) {
    const norm = m.trim().toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      list.push(norm);
    }
  }
  return list;
}

export const UserListPage: React.FC = () => {
  const { user: currentUser, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = (toastContext as any).toast || toastContext;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [selectedModalRole, setSelectedModalRole] = useState<RoleName>('MEMBER');
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [editEmailUser, setEditEmailUser] = useState<User | null>(null);
  const [editEmailForm, setEditEmailForm] = useState({ fullName: '', email: '' });
  const [editEmailError, setEditEmailError] = useState('');
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const [onboardMode, setOnboardMode] = useState<'single' | 'bulk'>('single');
  const [bulkEmailsText, setBulkEmailsText] = useState('');
  const [bulkEmailsError, setBulkEmailsError] = useState('');
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const [inviteForm, setInviteForm] = useState<{
    email: string;
    fullName: string;
    password: string;
    roleName: RoleName;
  }>({
    email: '',
    fullName: '',
    password: generateSecurePassword(),
    roleName: 'MEMBER',
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isInviteDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsInviteDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInviteDrawerOpen]);

  const {
    data: usersResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{
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
    queryKey: ['users', page, limit, debouncedSearch, roleFilter, statusFilter],
    queryFn: async () => {
      return api.get<{ data: User[]; meta: any }>('/users', {
        params: {
          page,
          limit,
          q: debouncedSearch || undefined,
          role: roleFilter || undefined,
          isActive: statusFilter || undefined,
        },
      });
    },
  });

  const rawUsersList = usersResponse?.data || [];
  const meta = usersResponse?.meta || {
    page: 1,
    limit: 10,
    total: rawUsersList.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  const displayedUsers = useMemo(() => {
    if (!rawUsersList) return [];
    if (!searchQuery.trim()) return rawUsersList;
    const q = searchQuery.toLowerCase().trim();
    return rawUsersList.filter(
      (u) =>
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [rawUsersList, searchQuery]);

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; fullName: string; roleName?: RoleName; password?: string }) =>
      api.post('/users', {
        email: data.email.trim().toLowerCase(),
        fullName: data.fullName.trim(),
        roleName: data.roleName || 'MEMBER',
        password: data.password || undefined,
      }),
    onSuccess: (_res, vars) => {
      toast.success(
        `Added ${vars.fullName.trim()} (${vars.email.trim().toLowerCase()}) and dispatched welcome email`
      );
      setIsInviteDrawerOpen(false);
      setInviteForm({
        email: '',
        fullName: '',
        password: generateSecurePassword(),
        roleName: 'MEMBER',
      });
      setInviteErrors({});
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add member');
    },
  });

  const bulkEmailMutation = useMutation({
    mutationFn: (rawText: string) => api.post('/users/bulk-email', { rawText }),
    onSuccess: (res: any) => {
      const payload = res?.data || res || {};
      const createdCount = payload.createdCount ?? 0;
      if (createdCount > 0) {
        toast.success(`Provisioned ${createdCount} member(s)`);
      } else {
        toast.info('All entered email addresses already exist in this workspace');
      }
      setBulkEmailsText('');
      setBulkEmailsError('');
      setIsInviteDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to bulk import members');
    },
  });

  const isCurrentUserAdmin =
    getRoleName(currentUser?.role) === 'TENANT_ADMIN' ||
    getRoleName(currentUser?.role) === 'SUPER_ADMIN';

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: RoleName }) =>
      api.patch(`/users/${userId}/role`, { roleName }),
    onMutate: async ({ userId, roleName }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousQueries = queryClient.getQueriesData<{ data: User[]; meta: any }>({
        queryKey: ['users'],
      });

      queryClient.setQueriesData<{ data: User[]; meta: any }>(
        { queryKey: ['users'] },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((u) => {
              if (u.id === userId) {
                return {
                  ...u,
                  role:
                    typeof u.role === 'object' && u.role !== null
                      ? { ...u.role, name: roleName }
                      : { id: roleName === 'TENANT_ADMIN' ? 2 : roleName === 'ASSET_MANAGER' ? 3 : 4, name: roleName },
                };
              }
              if (roleName === 'TENANT_ADMIN' && getRoleName(u.role) === 'TENANT_ADMIN') {
                return {
                  ...u,
                  role:
                    typeof u.role === 'object' && u.role !== null
                      ? { ...u.role, name: 'ASSET_MANAGER' }
                      : { id: 3, name: 'ASSET_MANAGER' },
                };
              }
              return u;
            }),
          };
        }
      );

      setRoleModalUser(null);
      return { previousQueries };
    },
    onSuccess: (_, vars) => {
      const targetUser = rawUsersList.find((u) => u.id === vars.userId);
      const recipientLabel = targetUser?.fullName
        ? `${targetUser.fullName} (${targetUser.email})`
        : targetUser?.email || 'member';
      if (vars.roleName === 'TENANT_ADMIN') {
        toast.success(`Admin ownership transferred and role-change email sent to ${recipientLabel}.`);
      } else {
        toast.success(
          `Role updated to ${ROLE_CONFIG[vars.roleName]?.label || vars.roleName} (email sent to ${recipientLabel})`
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      if (vars.roleName === 'TENANT_ADMIN' || vars.userId === currentUser?.id) {
        void refreshProfile().catch(() => {});
      }
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(err.message || 'Failed to update role');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/users/${userId}/status`, { isActive }),
    onMutate: async ({ userId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousQueries = queryClient.getQueriesData<{ data: User[]; meta: any }>({
        queryKey: ['users'],
      });

      queryClient.setQueriesData<{ data: User[]; meta: any }>(
        { queryKey: ['users'] },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((u) => (u.id === userId ? { ...u, isActive } : u)),
          };
        }
      );

      return { previousQueries };
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? 'Member activated' : 'Member deactivated');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(err.message || 'Failed to update status');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.post(`/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success('Password updated');
      setResetPasswordUser(null);
      setNewPassword('');
      setResetError('');
    },
    onError: (err: any) => {
      setResetError(err.message || 'Failed to reset password');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      toast.info('Member removed from workspace');
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove member');
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({
      userId,
      email,
      fullName,
    }: {
      userId: string;
      email: string;
      fullName?: string;
    }) => api.patch(`/users/${userId}`, { email, fullName }),
    onSuccess: async (_, vars) => {
      toast.success('Member profile updated');
      setEditEmailUser(null);
      setEditEmailError('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (vars.userId === currentUser?.id) {
        try {
          await refreshProfile();
        } catch {}
      }
    },
    onError: (err: any) => {
      setEditEmailError(err.message || 'Failed to update member details');
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = inviteForm.fullName.trim();
    const trimmedEmail = inviteForm.email.trim().toLowerCase();
    const nextErrors: Record<string, string> = {};

    if (!trimmedName || trimmedName.length < 2) {
      nextErrors.fullName = 'Please enter a valid name';
    }
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(nextErrors).length > 0) {
      setInviteErrors(nextErrors);
      return;
    }

    setInviteErrors({});
    inviteMutation.mutate({
      fullName: trimmedName,
      email: trimmedEmail,
      roleName: inviteForm.roleName,
      password: inviteForm.password,
    });
  };

  const handleBulkEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const detected = extractValidEmailsFromText(bulkEmailsText);
    if (detected.length === 0) {
      setBulkEmailsError('Please paste or upload at least one valid email address');
      return;
    }
    setBulkEmailsError('');
    bulkEmailMutation.mutate(bulkEmailsText);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setBulkEmailsText((prev) => (prev ? `${prev}\n${content}` : content));
      setBulkEmailsError('');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    if (!newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long');
      return;
    }
    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      newPassword,
    });
  };

  const handleEditEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmailUser) return;
    const trimmedName = editEmailForm.fullName.trim();
    const trimmedEmail = editEmailForm.email.trim().toLowerCase();
    if (!trimmedName || trimmedName.length < 2) {
      setEditEmailError('Please enter a valid member name');
      return;
    }
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setEditEmailError('Please enter a valid email address');
      return;
    }
    updateEmailMutation.mutate({
      userId: editEmailUser.id,
      email: trimmedEmail,
      fullName: trimmedName,
    });
  };

  const detectedBulkEmails = useMemo(
    () => extractValidEmailsFromText(bulkEmailsText),
    [bulkEmailsText]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Team &amp; Access Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage workspace members, assign role permissions, and automate credential delivery.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {/* Compact Admin Mail Configuration Icon Button */}
          <GmailSenderBanner variant="header-button" />

          <Button
            variant="primary"
            size="sm"
            iconLeft={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setOnboardMode('single');
              setInviteForm({
                email: '',
                fullName: '',
                password: generateSecurePassword(),
                roleName: 'MEMBER',
              });
              setInviteErrors({});
              setIsInviteDrawerOpen(true);
            }}
          >
            Add Member
          </Button>
        </div>
      </div>


      {/* Aligned Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            iconLeft={<Search className="w-4 h-4 text-slate-500" />}
            rightAction={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-36"
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="TENANT_ADMIN">Admin</option>
            <option value="ASSET_MANAGER">Asset Manager</option>
            <option value="MEMBER">Member</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-36"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
      </div>

      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{(error as any)?.message || 'Failed to load members.'}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="font-semibold text-rose-300 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Clean Team Members Table */}
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="row" className="h-14" />
          ))}
        </div>
      ) : displayedUsers.length === 0 ? (
        <div className="text-center py-14 px-6 bg-[#0b1120] border border-white/[0.07] rounded-xl space-y-3">
          <Users className="w-8 h-8 text-slate-500 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-white">
              {searchQuery ? 'No matching members' : 'No team members yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? `No members matched "${searchQuery}".`
                : 'Add members to collaborate on digital assets and allocate software seats.'}
            </p>
          </div>
          {searchQuery ? (
            <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              iconLeft={<UserPlus className="w-4 h-4" />}
              onClick={() => setIsInviteDrawerOpen(true)}
            >
              Add Member
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[#0b1120] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-white/[0.06]">
              <thead className="bg-white/[0.02] text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.06]">
                {displayedUsers.map((u) => {
                  const roleName = getRoleName(u.role);
                  const roleMeta = ROLE_CONFIG[roleName] || ROLE_CONFIG.MEMBER;
                  const isCurrent = currentUser?.id === u.id;
                  const isRowAdmin =
                    roleName === 'TENANT_ADMIN' || roleName === 'SUPER_ADMIN';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Member Name & Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={u.fullName}
                            src={u.avatarUrl || undefined}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">
                                {u.fullName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {u.email}
                      </td>

                      {/* Zero-Scroll Inline Role Control */}
                      <td className="py-3.5 px-4">
                        {isRowAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/25 text-indigo-200 border border-indigo-500/50 shadow-xs select-none">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{roleMeta.label}</span>
                            <span className="text-[10px] text-indigo-300/80 font-medium">
                              · Owner
                            </span>
                          </span>
                        ) : isCurrentUserAdmin ? (
                          <div className="inline-flex items-center gap-2">
                            <div
                              className="inline-flex items-center p-1 rounded-lg bg-[#04070f] border border-white/[0.09]"
                              role="group"
                              aria-label={`Role for ${u.fullName}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (roleName !== 'MEMBER') {
                                    changeRoleMutation.mutate({
                                      userId: u.id,
                                      roleName: 'MEMBER',
                                    });
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                                  roleName === 'MEMBER'
                                    ? 'bg-emerald-600 text-white font-semibold border border-emerald-400/50 shadow-sm shadow-emerald-950/60'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] font-normal border border-transparent'
                                }`}
                              >
                                {roleName === 'MEMBER' ? (
                                  <Check className="w-3 h-3 stroke-[2.5] shrink-0" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                                )}
                                <span>Member</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (roleName !== 'ASSET_MANAGER') {
                                    changeRoleMutation.mutate({
                                      userId: u.id,
                                      roleName: 'ASSET_MANAGER',
                                    });
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                                  roleName === 'ASSET_MANAGER'
                                    ? 'bg-sky-600 text-white font-semibold border border-sky-400/50 shadow-sm shadow-sky-950/60'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] font-normal border border-transparent'
                                }`}
                              >
                                {roleName === 'ASSET_MANAGER' ? (
                                  <Check className="w-3 h-3 stroke-[2.5] shrink-0" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                                )}
                                <span>Asset Manager</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setRoleModalUser(u);
                                setSelectedModalRole(roleName);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-indigo-200 hover:bg-indigo-950/50 border border-white/[0.07] hover:border-indigo-500/40 transition-colors cursor-pointer"
                              title="Transfer Admin ownership or view role permissions"
                            >
                              <ArrowRightLeft className="w-3 h-3 shrink-0" />
                              <span>Transfer Admin</span>
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border select-none ${roleMeta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${roleMeta.dotClass}`} />
                            <span>{roleMeta.label}</span>
                          </span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={u.isActive}
                            disabled={isCurrent || toggleStatusMutation.isPending}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                userId: u.id,
                                isActive: !u.isActive,
                              })
                            }
                            className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                              u.isActive ? 'bg-emerald-500' : 'bg-slate-700'
                            } ${isCurrent ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ${
                                u.isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs ${
                              u.isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Clean Action Icons */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditEmailUser(u);
                              setEditEmailForm({
                                fullName: u.fullName || '',
                                email: u.email || '',
                              });
                              setEditEmailError('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                            title="Edit member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordUser(u);
                              setNewPassword(generateSecurePassword());
                              setResetError('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => setDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-white/[0.06] bg-white/[0.01]">
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

      {/* Add Member Slide-Over Drawer */}
      {isInviteDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsInviteDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="relative w-screen max-w-md bg-[#0b1120] border-l border-white/[0.08] shadow-2xl flex flex-col h-full">
              <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Add Member
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Credentials and welcome instructions are sent automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInviteDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 pt-4">
                <div className="grid grid-cols-2 rounded-lg bg-[#050811] p-1 border border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => setOnboardMode('single')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                      onboardMode === 'single'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Single Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardMode('bulk')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                      onboardMode === 'bulk'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Bulk Import (CSV)
                  </button>
                </div>
              </div>

              {onboardMode === 'single' ? (
                <form
                  id="invite-user-form"
                  onSubmit={handleInviteSubmit}
                  className="flex-1 overflow-y-auto p-6 space-y-4"
                >
                  <Input
                    label="Full Name *"
                    type="text"
                    placeholder="Jane Doe"
                    value={inviteForm.fullName}
                    onChange={(e) => {
                      setInviteForm({ ...inviteForm, fullName: e.target.value });
                      if (inviteErrors.fullName) {
                        setInviteErrors((prev) => ({ ...prev, fullName: '' }));
                      }
                    }}
                    error={inviteErrors.fullName}
                    autoFocus
                  />

                  <Input
                    label="Email Address *"
                    type="email"
                    placeholder="jane@company.com"
                    value={inviteForm.email}
                    onChange={(e) => {
                      setInviteForm({ ...inviteForm, email: e.target.value });
                      if (inviteErrors.email) {
                        setInviteErrors((prev) => ({ ...prev, email: '' }));
                      }
                    }}
                    error={inviteErrors.email}
                  />

                  <Select
                    label="Role"
                    value={inviteForm.roleName}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        roleName: e.target.value as RoleName,
                      })
                    }
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ASSET_MANAGER">Asset Manager</option>
                  </Select>
                </form>
              ) : (
                <form
                  id="invite-user-form"
                  onSubmit={handleBulkEmailSubmit}
                  className="flex-1 overflow-y-auto p-6 space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        Email Addresses *
                      </label>
                      <input
                        ref={csvFileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleCsvFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => csvFileInputRef.current?.click()}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        Upload CSV / TXT
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      placeholder="Paste emails separated by commas or newlines..."
                      value={bulkEmailsText}
                      onChange={(e) => {
                        setBulkEmailsText(e.target.value);
                        if (bulkEmailsError) setBulkEmailsError('');
                      }}
                      className="w-full rounded-lg bg-[#050811] border border-white/[0.08] p-3 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    {bulkEmailsError && (
                      <p className="text-xs text-rose-400 mt-1">{bulkEmailsError}</p>
                    )}
                  </div>

                  <p className="text-xs text-slate-400">
                    {detectedBulkEmails.length} valid email(s) detected.
                  </p>
                </form>
              )}

              {/* Onboarding notification indicator */}
              <div className="px-6 py-2.5 bg-indigo-950/20 border-t border-indigo-900/30 text-[11px] text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Credentials &amp; Welcome Email: Dispatched Immediately
                </span>
                <span className="font-mono text-slate-400">SMTP Active</span>
              </div>

              <div className="p-4 border-t border-white/[0.07] flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsInviteDrawerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="invite-user-form"
                  variant="primary"
                  size="sm"
                  isLoading={
                    onboardMode === 'single'
                      ? inviteMutation.isPending
                      : bulkEmailMutation.isPending
                  }
                >
                  {onboardMode === 'single'
                    ? 'Add & Auto-Onboard'
                    : `Auto-Onboard ${detectedBulkEmails.length || ''} Members`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      <Modal
        isOpen={Boolean(resetPasswordUser)}
        onClose={() => setResetPasswordUser(null)}
        title="Reset Password"
        description={`Set a new password for ${resetPasswordUser?.fullName}`}
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setResetPasswordUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={resetPasswordMutation.isPending}
              onClick={handleResetPasswordSubmit}
            >
              Update Password
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="New Password *"
            type="text"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setResetError('');
            }}
            error={resetError}
            className="font-mono text-xs"
            rightAction={
              <button
                type="button"
                onClick={() => setNewPassword(generateSecurePassword())}
                className="p-1 text-slate-400 hover:text-indigo-400"
                title="Generate password"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            }
          />
        </div>
      </Modal>

      {/* Modal: Edit Member */}
      <Modal
        isOpen={Boolean(editEmailUser)}
        onClose={() => setEditEmailUser(null)}
        title="Edit Member"
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditEmailUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={updateEmailMutation.isPending}
              onClick={handleEditEmailSubmit}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditEmailSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            type="text"
            value={editEmailForm.fullName}
            onChange={(e) => {
              setEditEmailForm({ ...editEmailForm, fullName: e.target.value });
              setEditEmailError('');
            }}
            autoFocus
          />
          <Input
            label="Email Address *"
            type="email"
            value={editEmailForm.email}
            onChange={(e) => {
              setEditEmailForm({ ...editEmailForm, email: e.target.value });
              setEditEmailError('');
            }}
            error={editEmailError}
            className="font-mono text-xs"
          />
        </form>
      </Modal>

      {/* Modal: Manage Role & Ownership Transfer */}
      <Modal
        isOpen={Boolean(roleModalUser)}
        onClose={() => setRoleModalUser(null)}
        title="Role & Workspace Ownership"
        description={
          roleModalUser
            ? `Configure access level for ${roleModalUser.fullName} (${roleModalUser.email})`
            : ''
        }
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRoleModalUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={changeRoleMutation.isPending}
              disabled={
                !roleModalUser ||
                getRoleName(roleModalUser.role) === selectedModalRole
              }
              onClick={() => {
                if (!roleModalUser) return;
                changeRoleMutation.mutate({
                  userId: roleModalUser.id,
                  roleName: selectedModalRole,
                });
              }}
            >
              {selectedModalRole === 'TENANT_ADMIN'
                ? 'Transfer Admin Ownership'
                : 'Apply Role'}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {(['MEMBER', 'ASSET_MANAGER', 'TENANT_ADMIN'] as RoleName[]).map((r) => {
            const opt = ROLE_CONFIG[r];
            const isSelected = selectedModalRole === r;
            const isOwnershipOption = r === 'TENANT_ADMIN';

            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedModalRole(r)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? isOwnershipOption
                      ? 'bg-indigo-950/40 border-indigo-500/60 text-white'
                      : 'bg-white/[0.06] border-indigo-500/50 text-white'
                    : 'bg-[#050811] border-white/[0.07] hover:border-white/[0.15] text-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
                    <span className="text-xs font-semibold text-white">
                      {isOwnershipOption
                        ? 'Admin (Transfer Workspace Ownership)'
                        : opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pl-4">
                    {isOwnershipOption
                      ? 'Promotes this member to the sole Workspace Admin and automatically transitions your account to Asset Manager.'
                      : opt.description}
                  </p>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-slate-600'
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Confirm Dialog: Remove Member */}
      <ConfirmDialog
        isOpen={Boolean(deleteUser)}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => {
          if (deleteUser) deleteMutation.mutate(deleteUser.id);
        }}
        title="Remove Member"
        message={`Remove ${deleteUser?.fullName} from this workspace? Their active seat allocations will be released.`}
        confirmText="Remove"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
