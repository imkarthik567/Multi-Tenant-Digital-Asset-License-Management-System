import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  LogOut,
  Plus,
} from 'lucide-react';
import { api } from '../../services/api';
import { mergeClientWorkspaceEntities } from '../../services/localFallback';
import { License, LicenseAllocation, User } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { Pagination } from '../../components/common/Pagination';
import { RoleGate } from '../../components/auth/RoleGate';
import { Select, Button, Input } from '../../components/ui';

export const AllocationListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [releaseAllocationId, setReleaseAllocationId] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState('Administrative seat release');

  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [recipientMode, setRecipientMode] = useState<'existing' | 'email'>('existing');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');

  const {
    data: allocationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{
    data: LicenseAllocation[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['allocations', page, limit, statusFilter],
    queryFn: async () => {
      return api.get<{ data: LicenseAllocation[]; meta: any }>('/allocations', {
        params: {
          page,
          limit,
          status: statusFilter || undefined,
        },
      });
    },
  });

  const { data: licensesData } = useQuery<{ data: License[] }>({
    queryKey: ['licenses', 'for-allocation'],
    queryFn: async () => {
      return api.get<{ data: License[] }>('/licenses', {
        params: { limit: 100 },
      });
    },
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users', 'for-allocation'],
    queryFn: async () => {
      return api.get<{ data: User[] }>('/users', {
        params: { limit: 100 },
      });
    },
  });

  const availableLicenses = mergeClientWorkspaceEntities<License>(
    'license',
    licensesData?.data || []
  ).filter((l) => l.status !== 'CANCELLED' && l.status !== 'EXPIRED');
  const workspaceUsers = (usersData?.data || []).filter((u) => u.isActive !== false);

  const allocateMutation = useMutation({
    mutationFn: async (payload: {
      licenseId: string;
      userId?: string;
      userEmail?: string;
      userFullName?: string;
      notes?: string;
    }) => api.post('/allocations', payload),
    onSuccess: () => {
      toast({
        title: 'Seat Allocated',
        message: 'License seat has been provisioned.',
        type: 'success',
      });
      setIsAllocateModalOpen(false);
      setSelectedLicenseId('');
      setSelectedUserId('');
      setNewMemberName('');
      setNewMemberEmail('');
      setAllocationNotes('');
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Allocation Failed',
        message: err.message || 'Could not allocate license seat.',
        type: 'error',
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: ({ allocationId, reason }: { allocationId: string; reason: string }) =>
      api.post(`/allocations/${allocationId}/release`, { reason }),
    onSuccess: () => {
      toast({
        title: 'Seat Released',
        message: 'Seat returned to organization pool.',
        type: 'info',
      });
      setReleaseAllocationId(null);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Release Failed',
        message: err.message || 'Could not release license seat.',
        type: 'error',
      });
    },
  });

  const handleOpenAllocateModal = () => {
    if (!selectedLicenseId && availableLicenses.length > 0) {
      const firstLic = availableLicenses[0] as any;
      setSelectedLicenseId(firstLic.id || firstLic.license_id || '');
    }
    if (!selectedUserId && workspaceUsers.length > 0) {
      setSelectedUserId(workspaceUsers[0].id);
    }
    setIsAllocateModalOpen(true);
  };

  const handleConfirmAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicenseId) {
      toast({
        title: 'License Required',
        message: 'Please select a software license.',
        type: 'error',
      });
      return;
    }

    if (recipientMode === 'existing') {
      if (!selectedUserId) {
        toast({
          title: 'Member Required',
          message: 'Please select a workspace member.',
          type: 'error',
        });
        return;
      }
      allocateMutation.mutate({
        licenseId: selectedLicenseId,
        userId: selectedUserId,
        notes: allocationNotes.trim() || undefined,
      });
    } else {
      if (!newMemberName.trim() || newMemberName.trim().length < 2) {
        toast({
          title: 'Name Required',
          message: 'Please enter the member name.',
          type: 'error',
        });
        return;
      }
      if (!newMemberEmail.trim() || !newMemberEmail.includes('@')) {
        toast({
          title: 'Valid Email Required',
          message: 'Please enter a valid email address.',
          type: 'error',
        });
        return;
      }
      allocateMutation.mutate({
        licenseId: selectedLicenseId,
        userEmail: newMemberEmail.trim().toLowerCase(),
        userFullName: newMemberName.trim(),
        notes: allocationNotes.trim() || undefined,
      });
    }
  };

  const allocations = allocationsData?.data || [];
  const meta = allocationsData?.meta || { page: 1, limit: 15, total: 0, totalPages: 1 };

  const filtered = allocations.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const userName = a.user?.fullName?.toLowerCase() || '';
    const userEmail = a.user?.email?.toLowerCase() || '';
    const licName = a.license?.name?.toLowerCase() || '';
    return userName.includes(q) || userEmail.includes(q) || licName.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Allocations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track and manage software seats assigned across workspace members.
          </p>
        </div>

        <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="w-4 h-4" />}
            onClick={handleOpenAllocateModal}
          >
            Allocate Seat
          </Button>
        </RoleGate>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by member or license..."
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="REVOKED">Released</option>
        </Select>
      </div>

      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center justify-between text-xs text-rose-300">
          <span>{(error as any)?.message || 'Failed to load allocations.'}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Allocations Found"
          message="Allocate a software license seat to a workspace member to get started."
          action={{
            label: 'Allocate Seat',
            onClick: handleOpenAllocateModal,
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      ) : (
        <div className="rounded-xl border border-white/[0.07] overflow-hidden bg-[#0b1120]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-left text-xs">
              <thead className="bg-white/[0.02] text-slate-400 text-[11px] uppercase tracking-wider font-medium">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-4 py-3">License</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Allocated</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map((alloc, idx) => (
                  <tr
                    key={alloc.id || `alloc-${idx}`}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-white block">
                        {alloc.user?.fullName || 'Member'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {alloc.user?.email || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {alloc.license ? (
                        <Link
                          to={`/licenses/${alloc.license.id}`}
                          className="font-medium text-slate-200 hover:text-indigo-400 inline-flex items-center gap-1"
                        >
                          <span>{alloc.license.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </Link>
                      ) : (
                        <span className="text-slate-400">License</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {alloc.license?.vendor?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 font-mono">
                      {new Date(alloc.allocatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-medium ${
                          alloc.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {alloc.status === 'ACTIVE' ? 'Active' : 'Released'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {alloc.status === 'ACTIVE' ? (
                        <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <button
                            type="button"
                            onClick={() => setReleaseAllocationId(alloc.id)}
                            className="text-rose-400 hover:text-rose-300 font-medium inline-flex items-center gap-1"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Release</span>
                          </button>
                        </RoleGate>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">
                          {alloc.releasedAt
                            ? new Date(alloc.releasedAt).toLocaleDateString()
                            : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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

      {/* Allocate Seat Modal */}
      <Modal
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        title="Allocate Software Seat"
      >
        <form onSubmit={handleConfirmAllocate} className="space-y-4 text-xs">
          <Select
            label="Software License *"
            value={selectedLicenseId}
            onChange={(e) => setSelectedLicenseId(e.target.value)}
          >
            <option value="">Select a license...</option>
            {availableLicenses.map((lic: any, idx: number) => {
              const id = lic.id || lic.license_id || `lic-${idx}`;
              const used = lic.usedSeats ?? lic.used_seats ?? 0;
              const total = lic.totalSeats ?? lic.total_seats ?? 0;
              return (
                <option key={id} value={id}>
                  {lic.name || lic.license_name} ({used}/{total} seats used)
                </option>
              );
            })}
          </Select>

          <div className="grid grid-cols-2 rounded-lg bg-[#050811] p-1 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setRecipientMode('existing')}
              className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                recipientMode === 'existing'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Existing Member
            </button>
            <button
              type="button"
              onClick={() => setRecipientMode('email')}
              className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                recipientMode === 'email'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              New Member by Email
            </button>
          </div>

          {recipientMode === 'existing' ? (
            <Select
              label="Workspace Member *"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Select member...</option>
              {workspaceUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </Select>
          ) : (
            <div className="space-y-3">
              <Input
                label="Member Name *"
                type="text"
                placeholder="Jane Doe"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
              />
              <Input
                label="Member Email *"
                type="email"
                placeholder="jane@company.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
            </div>
          )}

          <Input
            label="Notes (Optional)"
            type="text"
            placeholder="Department or project reference..."
            value={allocationNotes}
            onChange={(e) => setAllocationNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAllocateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={allocateMutation.isPending}
            >
              Allocate Seat
            </Button>
          </div>
        </form>
      </Modal>

      {/* Release Seat Modal */}
      <Modal
        isOpen={!!releaseAllocationId}
        onClose={() => setReleaseAllocationId(null)}
        title="Release Seat"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Releasing this seat returns capacity to the license pool immediately.
          </p>
          <Input
            label="Reason"
            type="text"
            value={releaseReason}
            onChange={(e) => setReleaseReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setReleaseAllocationId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={releaseMutation.isPending}
              onClick={() =>
                releaseMutation.mutate({
                  allocationId: releaseAllocationId!,
                  reason: releaseReason,
                })
              }
            >
              Confirm Release
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
