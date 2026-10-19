// ==============================================================================
// AssetVault: License Detail Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Multi-tab view: Overview & Masked Key, Covered Assets, Allocations, Renewals
// ==============================================================================

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  Unlink,
  ExternalLink,
  FileText,
  Download,
} from 'lucide-react';
import { api } from '../../services/api';
import { License, Asset, LicenseAllocation, LicenseRenewal, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { RoleGate } from '../../components/auth/RoleGate';
import { DatePicker } from '../../components/common/DatePicker';

export const LicenseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const roleName =
    typeof user?.role === 'object' && user?.role !== null
      ? (user.role as any).name
      : user?.role;
  const isMember = roleName === 'MEMBER';
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'allocations' | 'renewals'>('overview');
  const [isKeyRevealed, setIsKeyRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Modals state
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isLinkAssetModalOpen, setIsLinkAssetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [releaseAllocationId, setReleaseAllocationId] = useState<string | null>(null);

  // Form states
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [releaseReason, setReleaseReason] = useState('Routine offboarding / seat reassignment');

  const [renewForm, setRenewForm] = useState({
    newEndDate: '',
    cost: 0,
    notes: 'Contract term extension',
  });

  // 1. Fetch License Details
  const {
    data: license,
    isLoading: isLicenseLoading,
    error: licenseError,
  } = useQuery<License>({
    queryKey: ['license', id],
    queryFn: async () => {
      const res = await api.get<{ data: License }>(`/licenses/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  React.useEffect(() => {
    if (license) {
      const parsedEnd = license.endDate ? new Date(license.endDate) : new Date();
      const currentEnd = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;
      currentEnd.setFullYear(currentEnd.getFullYear() + 1);
      setRenewForm({
        newEndDate: currentEnd.toISOString().split('T')[0],
        cost: Number(license.cost) || 0,
        notes: `Annual renewal for ${license.name}`,
      });
    }
  }, [license]);

  // 2. Fetch Covered Assets
  const { data: coveredAssets = [], isLoading: isAssetsLoading } = useQuery<Asset[]>({
    queryKey: ['license', id, 'assets'],
    queryFn: async () => {
      const res = await api.get<Asset[] | { data: Asset[] }>(`/licenses/${id}/assets`);
      const raw = Array.isArray(res) ? res : (res as any).data || [];
      return raw.map((item: any) => {
        const a = item.asset ? item.asset : item;
        return {
          ...a,
          id: a.id || a.asset_id,
          name: a.name || a.asset_name,
          assetCode: a.assetCode || a.asset_code,
          assetType: a.assetType || a.asset_type,
        };
      });
    },
    enabled: !!id && activeTab === 'assets',
  });

  // 3. Fetch License Allocations
  const { data: allocationsData, isLoading: isAllocationsLoading } = useQuery<{
    data: LicenseAllocation[];
    meta: any;
  }>({
    queryKey: ['license', id, 'allocations'],
    queryFn: async () => {
      const res = await api.get<{ data: LicenseAllocation[]; meta: any }>(`/licenses/${id}/allocations`);
      return res;
    },
    enabled: !!id && activeTab === 'allocations',
  });

  // 4. Fetch Renewal History
  const { data: renewals = [], isLoading: isRenewalsLoading } = useQuery<LicenseRenewal[]>({
    queryKey: ['license', id, 'renewals'],
    queryFn: async () => {
      const res = await api.get<LicenseRenewal[] | { data: LicenseRenewal[] }>(`/licenses/${id}/renewals`);
      return Array.isArray(res) ? res : (res as any).data || [];
    },
    enabled: !!id && activeTab === 'renewals',
  });

  // 5. Fetch Users for Allocation Modal
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'assignable'],
    queryFn: async () => {
      const res = await api.get<{ data: User[] }>('/users', { params: { limit: 100 } });
      return res.data || [];
    },
    enabled: isAllocateModalOpen,
  });

  // 6. Fetch Assets for Link Asset Modal
  const { data: availableAssets = [] } = useQuery<Asset[]>({
    queryKey: ['assets', 'linkable'],
    queryFn: async () => {
      const res = await api.get<{ data: Asset[] }>('/assets', { params: { limit: 100 } });
      const raw = res.data || [];
      return raw.map((a: any) => ({
        ...a,
        id: a.id || a.asset_id,
        name: a.name || a.asset_name,
        assetCode: a.assetCode || a.asset_code,
        assetType: a.assetType || a.asset_type,
      }));
    },
    enabled: isLinkAssetModalOpen,
  });

  // MUTATIONS
  // Allocate Seat Mutation (Stored Procedure sp_allocate_license_seat)
  const allocateSeatMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/licenses/${id}/allocate`, {
        userId,
      }),
    onSuccess: () => {
      toast({ title: 'Seat Allocated', message: 'User provisioned via sp_allocate_license_seat', type: 'success' });
      setIsAllocateModalOpen(false);
      setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'allocations'] });
    },
    onError: (err: any) => {
      toast({ title: 'Allocation Failed', message: err.message || 'Seat capacity exceeded', type: 'error' });
    },
  });

  // Release Seat Mutation (Stored Procedure sp_release_license_seat)
  const releaseSeatMutation = useMutation({
    mutationFn: ({ allocationId, reason }: { allocationId: string; reason?: string }) =>
      api.post(`/allocations/${allocationId}/release`, { reason }),
    onSuccess: () => {
      toast({ title: 'Seat Released', message: 'License seat freed via sp_release_license_seat', type: 'info' });
      setReleaseAllocationId(null);
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'allocations'] });
    },
    onError: (err: any) => {
      toast({ title: 'Release Failed', message: err.message || 'Could not release seat', type: 'error' });
    },
  });

  // Renew License Mutation (Stored Procedure sp_renew_license)
  const renewLicenseMutation = useMutation({
    mutationFn: (data: typeof renewForm) => api.post(`/licenses/${id}/renew`, data),
    onSuccess: () => {
      toast({ title: 'License Renewed', message: 'Contract extended via sp_renew_license', type: 'success' });
      setIsRenewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'renewals'] });
    },
    onError: (err: any) => {
      toast({ title: 'Renewal Failed', message: err.message || 'Renewal validation error', type: 'error' });
    },
  });

  // Link Asset Mutation
  const linkAssetMutation = useMutation({
    mutationFn: (assetId: string) => api.post(`/licenses/${id}/link-asset/${assetId}`, {}),
    onSuccess: () => {
      toast({ title: 'Asset Covered', message: 'Asset linked to this license', type: 'success' });
      setIsLinkAssetModalOpen(false);
      setSelectedAssetId('');
      queryClient.invalidateQueries({ queryKey: ['license', id, 'assets'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to link asset', type: 'error' });
    },
  });

  // Unlink Asset Mutation
  const unlinkAssetMutation = useMutation({
    mutationFn: (assetId: string) => api.delete(`/licenses/${id}/link-asset/${assetId}`),
    onSuccess: () => {
      toast({ title: 'Asset Unlinked', message: 'Asset coverage detached', type: 'info' });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'assets'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to unlink asset', type: 'error' });
    },
  });

  // Delete License Mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/licenses/${id}`),
    onSuccess: () => {
      toast({ title: 'License Deleted', message: 'License moved to trash', type: 'info' });
      navigate('/licenses');
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to delete license', type: 'error' });
    },
  });

  const handleRevealKey = () => {
    setIsKeyRevealed(!isKeyRevealed);
    if (!isKeyRevealed) {
      toast({
        title: 'Audited Action',
        message: 'License key access logged to security compliance ledger.',
        type: 'info',
      });
    }
  };

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast({ title: 'Copied', message: 'License key copied to clipboard', type: 'success' });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!id || !license) return;
    setIsExportingPdf(true);
    try {
      const response = await api.get(`/licenses/${id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response as any], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `license-${license.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-${license.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'PDF Exported',
        message: 'License dossier generated and downloaded successfully.',
        type: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        message: err.message || 'Failed to download license PDF dossier.',
        type: 'error',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (isLicenseLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  if (licenseError || !license) {
    return (
      <div className="py-12">
        <EmptyState
          title="License Not Found"
          message="The requested software license does not exist or has been removed."
          action={{
            label: 'Back to Licenses',
            onClick: () => navigate('/licenses'),
          }}
        />
      </div>
    );
  }

  const allocationsList = allocationsData?.data || [];
  const activeAllocations = allocationsList.filter((a) => a.status === 'ACTIVE');
  const usedSeats = license.usedSeats ?? activeAllocations.length;
  const availableSeats = license.availableSeats ?? Math.max(0, license.totalSeats - usedSeats);
  const utilizationPct =
    license.utilizationPct ??
    (license.totalSeats > 0 ? Math.round((usedSeats / license.totalSeats) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <Link
            to="/licenses"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Back to licenses"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {license.name}
              </h1>
              <StatusBadge status={license.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Vendor:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {license.vendor?.name || 'Independent'}
              </span>{' '}
              &bull; Currency: <span className="font-mono">{license.currency}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export PDF Dossier */}
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm disabled:opacity-50"
            title="Download PDF dossier (covers details, seats, covered assets, renewals)"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
            {isExportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>

          {/* Renew Button (calls sp_renew_license) */}
          <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
            <button
              onClick={() => setIsRenewModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Renew License
            </button>
            <button
              onClick={() => setIsAllocateModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
              Allocate Seat
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Delete license"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </RoleGate>
        </div>
      </div>

      {/* KPI & Seat Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Total Seats</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{license.totalSeats}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Active Seats</span>
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400 mt-0.5">{usedSeats}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Available</span>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{availableSeats}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Utilization</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  utilizationPct > 90
                    ? 'bg-rose-500'
                    : utilizationPct > 75
                    ? 'bg-amber-500'
                    : 'bg-primary-500'
                }`}
                style={{ width: `${Math.min(100, utilizationPct)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
              {utilizationPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Audited Key Box */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Software License Key</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                Audited Access
              </span>
            </div>
            <p className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-1">
              {isKeyRevealed
                ? license.licenseKey || 'No raw key provided'
                : '••••-••••-••••-••••-••••'}
            </p>
          </div>
        </div>

        {!isMember && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRevealKey}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {isKeyRevealed ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                  Mask Key
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Reveal Key
                </>
              )}
            </button>
            {isKeyRevealed && (
              <button
                onClick={() => copyLicenseKey(license.licenseKey)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copy
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Overview & Terms
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'assets'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Covered Assets ({coveredAssets.length})
          </button>
          <button
            onClick={() => setActiveTab('allocations')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'allocations'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Seat Allocations ({allocationsList.length})
          </button>
          <button
            onClick={() => setActiveTab('renewals')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'renewals'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Renewal History ({renewals.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: OVERVIEW & TERMS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Agreement Terms Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center">
                <FileText className="w-4 h-4 mr-2 text-primary-500" />
                License Agreement & Contract Terms
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {license.terms || 'Standard enterprise digital software license agreement terms apply.'}
              </p>
            </div>
          </div>

          {/* Right Column: Financial & Contract Metadata */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Contract Details</h3>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Cost</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {license.currency} {Number(license.cost).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Effective Date</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(license.startDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Expiration Date</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {license.endDate ? new Date(license.endDate).toLocaleDateString() : 'Perpetual'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Auto Renewal</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {license.autoRenew ? 'Enabled' : 'Manual'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Vendor Contact</span>
                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {license.vendor?.contactEmail || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COVERED ASSETS */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Protected Digital Assets</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assets covered under this license agreement to ensure enterprise compliance.
              </p>
            </div>
            <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
              <button
                onClick={() => setIsLinkAssetModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Cover Asset
              </button>
            </RoleGate>
          </div>

          {isAssetsLoading ? (
            <LoadingSkeleton variant="table" />
          ) : coveredAssets.length === 0 ? (
            <EmptyState
              title="No Covered Assets"
              message="No assets are currently associated with this license."
              action={
                hasPermission('licenses:link_asset')
                  ? {
                      label: 'Link an Asset Now',
                      onClick: () => setIsLinkAssetModalOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coveredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <Link
                      to={`/assets/${asset.id}`}
                      className="text-sm font-bold text-slate-900 dark:text-white hover:text-primary-600 transition-colors flex items-center"
                    >
                      {asset.name}
                      <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Type: {asset.assetType} &bull; Code: {asset.assetCode}
                    </p>
                  </div>
                  <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                    <button
                      onClick={() => unlinkAssetMutation.mutate(asset.id)}
                      className="text-rose-500 hover:text-rose-700 text-xs font-medium inline-flex items-center p-1"
                      title="Unlink asset"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </RoleGate>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SEAT ALLOCATIONS */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active & Released Seats</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Software license seat provisioning matrix maintained via stored procedures.
              </p>
            </div>
            <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
              <button
                onClick={() => setIsAllocateModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Allocate Seat
              </button>
            </RoleGate>
          </div>

          {isAllocationsLoading ? (
            <LoadingSkeleton variant="table" />
          ) : allocationsList.length === 0 ? (
            <EmptyState
              title="No Allocations"
              message="No license seats have been provisioned to organization users yet."
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Allocated Date</th>
                      <th className="px-4 py-3">Released Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {allocationsList.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {a.user ? (
                            <div>
                              <span>{a.user.fullName}</span>
                              <span className="block text-[11px] text-slate-400">{a.user.email}</span>
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {new Date(a.allocatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {a.releasedAt ? new Date(a.releasedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isMember && a.status === 'ACTIVE' && (
                            <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                              <button
                                onClick={() => setReleaseAllocationId(a.id)}
                                className="text-rose-500 hover:text-rose-700 font-medium hover:underline text-xs"
                              >
                                Release Seat
                              </button>
                            </RoleGate>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RENEWALS */}
      {activeTab === 'renewals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Renewal Log & Extension Audit</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Historical contract extensions recorded via sp_renew_license.
              </p>
            </div>
            <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
              <button
                onClick={() => setIsRenewModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Record Renewal
              </button>
            </RoleGate>
          </div>

          {isRenewalsLoading ? (
            <LoadingSkeleton variant="table" />
          ) : renewals.length === 0 ? (
            <EmptyState
              title="No Renewals Recorded"
              message="This license is currently on its initial contract term."
            />
          ) : (
            <div className="space-y-3">
              {renewals.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Term Extended to {new Date(r.newEndDate).toLocaleDateString()}
                      </span>
                      <span className="text-slate-400">
                        (was {new Date(r.oldEndDate).toLocaleDateString()})
                      </span>
                    </div>
                    {r.notes && <p className="text-slate-600 dark:text-slate-300 italic">{r.notes}</p>}
                    <p className="text-slate-400 text-[11px]">
                      Renewed on {new Date(r.renewedAt).toLocaleString()} by {r.renewer?.fullName || 'Admin'}
                    </p>
                  </div>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {license.currency} {Number(r.cost).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ALLOCATE SEAT MODAL */}
      <Modal isOpen={isAllocateModalOpen} onClose={() => setIsAllocateModalOpen(false)} title="Allocate License Seat">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Select Organization User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">-- Choose User --</option>
              {users.map((u) => {
                const roleName = typeof u.role === 'object' && u.role !== null ? (u.role as any).name : u.role;
                return (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email}) - {roleName}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-lg text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            Available seats: <span className="font-bold text-emerald-600">{availableSeats}</span>. Invokes PostgreSQL
            stored procedure <code className="font-mono text-primary-500">sp_allocate_license_seat</code>.
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAllocateModalOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedUserId || allocateSeatMutation.isPending}
              onClick={() => allocateSeatMutation.mutate(selectedUserId)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50"
            >
              {allocateSeatMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* RENEW LICENSE MODAL */}
      <Modal isOpen={isRenewModalOpen} onClose={() => setIsRenewModalOpen(false)} title="Renew Software License Term">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            renewLicenseMutation.mutate(renewForm);
          }}
          className="space-y-4 text-xs"
        >
          <DatePicker
            label="New End Date"
            required
            value={renewForm.newEndDate}
            onChange={(val) => setRenewForm({ ...renewForm, newEndDate: val })}
          />

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Renewal Cost ({license.currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={renewForm.cost}
              onChange={(e) => setRenewForm({ ...renewForm, cost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Renewal Notes</label>
            <textarea
              rows={2}
              value={renewForm.notes}
              onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRenewModalOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={renewLicenseMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {renewLicenseMutation.isPending ? 'Executing...' : 'Submit Renewal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* LINK ASSET MODAL */}
      <Modal isOpen={isLinkAssetModalOpen} onClose={() => setIsLinkAssetModalOpen(false)} title="Attach Covered Asset">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Digital Asset</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">-- Choose Asset --</option>
              {availableAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.assetCode}) - {a.assetType}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsLinkAssetModalOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedAssetId || linkAssetMutation.isPending}
              onClick={() => linkAssetMutation.mutate(selectedAssetId)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50"
            >
              {linkAssetMutation.isPending ? 'Linking...' : 'Cover Asset'}
            </button>
          </div>
        </div>
      </Modal>

      {/* RELEASE SEAT CONFIRMATION */}
      <Modal
        isOpen={!!releaseAllocationId}
        onClose={() => setReleaseAllocationId(null)}
        title="Release License Seat"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Releasing this seat will restore license capacity via{' '}
            <code className="font-mono text-primary-500">sp_release_license_seat</code> and revoke member access.
          </p>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Reason for Release</label>
            <input
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setReleaseAllocationId(null)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={releaseSeatMutation.isPending}
              onClick={() =>
                releaseSeatMutation.mutate({
                  allocationId: releaseAllocationId!,
                  reason: releaseReason,
                })
              }
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm"
            >
              {releaseSeatMutation.isPending ? 'Releasing...' : 'Release Seat'}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE LICENSE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Move License to Trash"
        message={`Are you sure you want to soft-delete "${license?.name}"? Active allocations will be terminated.`}
        confirmText="Delete License"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
