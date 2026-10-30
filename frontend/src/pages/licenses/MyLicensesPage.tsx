import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  LogOut,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  Package,
} from 'lucide-react';
import { api } from '../../services/api';
import { LicenseAllocation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';

type FilterTab = 'ACTIVE' | 'EXPIRING_SOON' | 'ALL' | 'RELEASED';

function getDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function maskLicenseKey(rawKey?: string | null): string {
  if (!rawKey) return '••••-••••-••••-••••';
  const parts = rawKey.split('-');
  if (parts.length >= 3) {
    return `${parts[0]}-${parts.slice(1, -1).map(() => '••••').join('-')}-${parts[parts.length - 1]}`;
  }
  if (rawKey.length <= 6) return '••••••••';
  return `${rawKey.slice(0, 4)}••••••••${rawKey.slice(-4)}`;
}

export const MyLicensesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('ACTIVE');
  const [showAllKeys, setShowAllKeys] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [releaseAllocationId, setReleaseAllocationId] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState('Project completed / seat self-release');

  const { data: allocationsData, isLoading } = useQuery<{
    data: LicenseAllocation[];
    meta: any;
  }>({
    queryKey: ['my-allocations', user?.id],
    queryFn: async () => {
      if (!user?.id) return { data: [], meta: {} };
      return api.get<{ data: LicenseAllocation[]; meta: any }>(`/users/${user.id}/allocations`);
    },
    enabled: !!user?.id,
  });

  const releaseMutation = useMutation({
    mutationFn: ({ allocationId, reason }: { allocationId: string; reason: string }) =>
      api.post(`/allocations/${allocationId}/release`, { reason }),
    onSuccess: () => {
      toast({
        title: 'Seat Released',
        message: 'Your license seat was returned to the organization pool.',
        type: 'info',
      });
      setReleaseAllocationId(null);
      queryClient.invalidateQueries({ queryKey: ['my-allocations'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Release Failed',
        message: err.message || 'Unable to release license seat.',
        type: 'error',
      });
    },
  });

  const allocations = allocationsData?.data || [];

  const activeAllocations = useMemo(
    () => allocations.filter((a) => a.status === 'ACTIVE'),
    [allocations]
  );

  const expiringSoonAllocations = useMemo(
    () =>
      activeAllocations.filter((a) => {
        const days = getDaysUntil(a.license?.endDate);
        return days !== null && days >= 0 && days <= 30;
      }),
    [activeAllocations]
  );

  const releasedAllocations = useMemo(
    () => allocations.filter((a) => a.status !== 'ACTIVE'),
    [allocations]
  );

  const filteredAllocations = useMemo(() => {
    let base: LicenseAllocation[] = activeAllocations;
    if (filterTab === 'EXPIRING_SOON') base = expiringSoonAllocations;
    else if (filterTab === 'RELEASED') base = releasedAllocations;
    else if (filterTab === 'ALL') base = allocations;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;

    return base.filter((alloc) => {
      const licName = alloc.license?.name?.toLowerCase() || '';
      const vendorName = alloc.license?.vendor?.name?.toLowerCase() || '';
      const keyStr = alloc.license?.licenseKey?.toLowerCase() || '';
      return licName.includes(q) || vendorName.includes(q) || keyStr.includes(q);
    });
  }, [allocations, activeAllocations, expiringSoonAllocations, releasedAllocations, filterTab, searchQuery]);

  const isKeyVisible = (allocId: string) => {
    if (allocId in revealedIds) {
      return revealedIds[allocId];
    }
    return showAllKeys;
  };

  const toggleKeyVisibility = (allocId: string) => {
    const current = isKeyVisible(allocId);
    setRevealedIds((prev) => ({
      ...prev,
      [allocId]: !current,
    }));
  };

  const handleToggleAllKeys = () => {
    setShowAllKeys((prev) => !prev);
    setRevealedIds({});
  };

  const handleCopyKey = async (allocId: string, keyText?: string | null) => {
    if (!keyText) return;
    try {
      await navigator.clipboard.writeText(keyText);
      setCopiedId(allocId);
      toast({
        title: 'Software Key Copied',
        message: 'License key copied to clipboard.',
        type: 'success',
      });
      setTimeout(() => {
        setCopiedId((prev) => (prev === allocId ? null : prev));
      }, 2000);
    } catch {
      toast({
        title: 'Copy Failed',
        message: 'Could not copy key to clipboard.',
        type: 'error',
      });
    }
  };

  const selectedReleaseAllocation = useMemo(
    () => allocations.find((a) => a.id === releaseAllocationId) || null,
    [allocations, releaseAllocationId]
  );

  return (
    <div className="space-y-6">
      {/* Minimalist Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            My Licenses
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Allocated software seats and activation keys for your account.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleAllKeys}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0b1120] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors self-start sm:self-auto"
        >
          {showAllKeys ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Mask Keys</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reveal Keys</span>
            </>
          )}
        </button>
      </div>

      {/* Clean Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'ACTIVE' as FilterTab, label: `Active (${activeAllocations.length})` },
            { id: 'EXPIRING_SOON' as FilterTab, label: `Expiring Soon (${expiringSoonAllocations.length})` },
            { id: 'ALL' as FilterTab, label: `All (${allocations.length})` },
            ...(releasedAllocations.length > 0
              ? [{ id: 'RELEASED' as FilterTab, label: `Released (${releasedAllocations.length})` }]
              : []),
          ].map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white/[0.09] text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter licenses..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#0b1120] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
          />
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : filteredAllocations.length === 0 ? (
        <EmptyState
          title={
            searchQuery
              ? 'No Matching Allocations'
              : filterTab === 'EXPIRING_SOON'
              ? 'No Seats Expiring Soon'
              : 'No Active License Allocations'
          }
          message={
            searchQuery
              ? `No software allocations matched "${searchQuery}".`
              : filterTab === 'EXPIRING_SOON'
              ? 'All of your active software seats have healthy expiration dates.'
              : 'You do not currently hold any assigned software license seats.'
          }
          action={{
            label: searchQuery ? 'Clear Filter' : 'Browse Assets',
            onClick: () => {
              if (searchQuery) setSearchQuery('');
              else navigate('/assets');
            },
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAllocations.map((alloc: any, allocIdx: number) => {
            const allocKey = alloc.id || alloc.allocation_id || `alloc-${allocIdx}`;
            const license = alloc.license;
            const keyVisible = isKeyVisible(allocKey);
            const isCopied = copiedId === allocKey;
            const coveredAssets =
              license?.assetLicenses?.map((al: any) => al.asset).filter(Boolean) || [];

            return (
              <div
                key={allocKey}
                className="rounded-xl bg-[#0b1120] border border-white/[0.07] hover:border-white/[0.14] transition-colors overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  {/* Minimalist Vendor & License Header (Zero status chip clutter) */}
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 truncate">
                      {license?.vendor?.name || 'Enterprise Software'}
                    </p>
                    <h3 className="text-sm font-semibold text-white mt-0.5 truncate">
                      {license?.name || 'Software License'}
                    </h3>
                  </div>

                  {/* Clean Dates Row */}
                  <div className="grid grid-cols-2 gap-3 py-2.5 border-y border-white/[0.06] text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Allocated</span>
                      <span className="font-mono text-slate-200 mt-0.5 block">
                        {new Date(alloc.allocatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Expires</span>
                      <span className="font-mono text-slate-200 mt-0.5 block">
                        {license?.endDate
                          ? new Date(license.endDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                            })
                          : 'Perpetual'}
                      </span>
                    </div>
                  </div>

                  {/* Clean Software Key Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Software Key</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(allocKey)}
                          className="text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                        >
                          {keyVisible ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Hide</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Show</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(allocKey, license?.licenseKey)}
                          disabled={!license?.licenseKey}
                          className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="px-3 py-2 rounded-lg bg-[#050811] border border-white/[0.06]">
                      <code className="text-xs font-mono text-slate-200 truncate block select-all">
                        {keyVisible
                          ? license?.licenseKey || 'N/A-KEY-UNAVAILABLE'
                          : maskLicenseKey(license?.licenseKey)}
                      </code>
                    </div>
                  </div>

                  {/* Covered Digital Assets (if linked) */}
                  {coveredAssets.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 block">
                        Covered Assets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {coveredAssets.slice(0, 3).map((asset: any, assetIdx: number) => {
                          const assetId = asset.id || asset.asset_id || `cov-${assetIdx}`;
                          const assetName = asset.name || asset.asset_name || 'Digital Asset';
                          return (
                            <Link
                              key={assetId}
                              to={`/assets/${assetId}`}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-white/[0.04] text-slate-300 hover:text-white border border-white/[0.06] transition-colors truncate"
                            >
                              <Package className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{assetName}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Minimal Footer */}
                <div className="px-5 py-3 bg-white/[0.02] border-t border-white/[0.06] flex justify-between items-center text-xs">
                  <Link
                    to={`/licenses/${license?.id}`}
                    className="text-slate-300 hover:text-white font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  {alloc.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => setReleaseAllocationId(alloc.id)}
                      className="text-rose-400 hover:text-rose-300 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Release</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500">
                      {alloc.releasedAt
                        ? `Released ${new Date(alloc.releasedAt).toLocaleDateString()}`
                        : 'Released'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RELEASE SEAT MODAL */}
      <Modal
        isOpen={!!releaseAllocationId}
        onClose={() => setReleaseAllocationId(null)}
        title="Release License Seat"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Releasing{' '}
            <span className="font-semibold text-white">
              {selectedReleaseAllocation?.license?.name || 'this software seat'}
            </span>{' '}
            will immediately return capacity to your organization pool.
          </p>

          <div>
            <label className="block text-slate-400 font-medium mb-1.5">
              Reason
            </label>
            <input
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-white/[0.1] bg-[#050811] text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setReleaseAllocationId(null)}
              className="px-3.5 py-1.5 text-slate-300 hover:bg-white/[0.05] rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={releaseMutation.isPending}
              onClick={() =>
                releaseMutation.mutate({
                  allocationId: releaseAllocationId!,
                  reason: releaseReason,
                })
              }
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {releaseMutation.isPending ? 'Releasing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
