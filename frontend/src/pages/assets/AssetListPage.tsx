// ==============================================================================
// AssetVault: Digital Asset Catalog & Lifecycle Management
// Course: BCSE307L Database Systems (Fall 2026-27)
// Grid/Table toggle, soft-delete with undo, CSV bulk import with preview, CSV export
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, apiClient, getAccessToken } from '../../services/api';
import { Asset, Category, AssetType } from '../../types';
import { useToast } from '../../context/ToastContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { SearchInput } from '../../components/common/SearchInput';
import { FilterBar } from '../../components/common/FilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { FormField } from '../../components/common/FormField';
import { TagInput } from '../../components/common/TagInput';
import { RoleGate } from '../../components/auth/RoleGate';
import { FileUrlField } from '../../components/common/FileUrlField';
import {
  Plus,
  Upload,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  ExternalLink,
  FileCode,
  Image,
  Video,
  FileText,
  Binary,
  Layers,
} from 'lucide-react';

export const AssetListPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state synchronization
  const q = searchParams.get('q') || '';
  const assetType = searchParams.get('assetType') || '';
  const status = searchParams.get('status') || 'ACTIVE';
  const categoryId = searchParams.get('categoryId') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sort = searchParams.get('sort') || 'name';
  const order = (searchParams.get('order') || 'asc') as 'asc' | 'desc';

  // UI Local States
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<any | null>(null);

  // Asset creation form state
  const [createForm, setCreateForm] = useState({
    name: '',
    assetCode: '',
    assetType: 'SOFTWARE' as AssetType,
    categoryId: '',
    description: '',
    fileUrl: '',
    fileSizeBytes: 1048576,
    versionNo: 1,
    checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    tags: [] as string[],
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // CSV Import States
  const [csvContent, setCsvContent] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);

  // Update query string helper
  const updateParams = (updates: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === '') {
        next.delete(key);
      } else {
        next.set(key, String(val));
      }
    });
    setSearchParams(next);
  };

  // 1. Fetch Assets Query
  const {
    data: assetsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['assets', q, assetType, status, categoryId, page, limit, sort, order],
    queryFn: async () => {
      return api.get<{ data: Asset[]; meta: any }>('/assets', {
        q: q || undefined,
        assetType: assetType || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        page,
        limit,
        sort,
        order,
      });
    },
  });

  // 2. Fetch Categories for Filter Dropdown
  const { data: categoriesResponse } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: Category[] }>('/categories', { limit: 100 }),
  });

  // Create Asset Mutation
  const createAssetMutation = useMutation({
    mutationFn: (payload: any) => api.post('/assets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowCreateModal(false);
      toast.success('Asset successfully created in repository');
      setCreateForm({
        name: '',
        assetCode: '',
        assetType: 'SOFTWARE',
        categoryId: '',
        description: '',
        fileUrl: '',
        fileSizeBytes: 1048576,
        versionNo: 1,
        checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        tags: [],
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create asset');
    },
  });

  // Soft Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDeleteAssetTarget(null);
      toast.success('Asset moved to Trash', 'Soft Deleted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete asset'),
  });

  // Restore Asset Mutation
  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/assets/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset restored to active catalog');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to restore asset'),
  });

  // Bulk CSV Import Mutation
  const bulkImportMutation = useMutation({
    mutationFn: (csvText: string) =>
      api.post('/assets/bulk-import', csvText, { 'Content-Type': 'text/csv' }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowCsvModal(false);
      setCsvContent('');
      setCsvPreviewRows([]);
      toast.success(res.data?.message || 'Bulk import completed successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'CSV Bulk Import Failed - All changes rolled back');
    },
  });

  // Parse CSV Preview
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);

      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        const rows = lines.slice(1, 6).map((line) => {
          const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          return {
            assetCode: cols[0],
            name: cols[1],
            assetType: cols[2],
            description: cols[3],
          };
        });
        setCsvPreviewRows(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = async () => {
    try {
      toast.info('Generating asset CSV export...');
      const token = getAccessToken();
      const response = await apiClient.get('/assets/export', {
        responseType: 'blob',
        params: token ? { token } : undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `assets-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Asset catalog exported successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV');
    }
  };

  const assets = (assetsResponse?.data || []) as any[];
  const meta = assetsResponse?.meta;
  const categories = (categoriesResponse?.data || []) as Category[];

  // Define Columns
  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Asset Details',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
            {row.asset_type === 'SOFTWARE' && <FileCode className="w-4 h-4 text-indigo-500" />}
            {row.asset_type === 'IMAGE' && <Image className="w-4 h-4 text-emerald-500" />}
            {row.asset_type === 'VIDEO' && <Video className="w-4 h-4 text-rose-500" />}
            {row.asset_type === 'DOCUMENT' && <FileText className="w-4 h-4 text-amber-500" />}
            {row.asset_type === 'DATASET' && <Binary className="w-4 h-4 text-cyan-500" />}
            {row.asset_type === 'FONT' && <Layers className="w-4 h-4 text-purple-500" />}
          </div>
          <div>
            <Link
              to={`/assets/${row.asset_id || row.id}`}
              className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block"
            >
              {row.asset_name || row.name}
            </Link>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                {row.asset_code || row.assetCode}
              </span>
              <span>&bull;</span>
              <span>v{row.latest_version_no || 1}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'assetType',
      header: 'Type',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {row.asset_type || row.assetType}
        </span>
      ),
    },
    {
      key: 'complianceStatus',
      header: 'Compliance',
      render: (row) => (
        <StatusBadge
          status={row.compliance_status || (row.status === 'ACTIVE' ? 'COMPLIANT' : 'UNLICENSED')}
          size="sm"
        />
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.category_name || row.category?.name || 'Uncategorized'}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[120px] block">
          {row.owner_name || row.owner?.fullName || 'System'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/assets/${row.asset_id || row.id}`}
            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="View Details"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

          {status === 'ARCHIVED' ? (
            <button
              type="button"
              onClick={() => restoreMutation.mutate(row.asset_id || row.id)}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
              title="Restore Asset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <RoleGate permission="assets:delete">
              <button
                type="button"
                onClick={() => setDeleteAssetTarget(row)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                title="Move to Trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </RoleGate>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Digital Asset Repository
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enterprise assets, version timeline integrity, license attachments, and checkout status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Bulk Import Button */}
          <RoleGate permission="assets:create">
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl shadow-xs transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Import CSV</span>
            </button>
          </RoleGate>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Export CSV</span>
          </button>

          {/* Add Asset Button */}
          <RoleGate permission="assets:create">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </button>
          </RoleGate>
        </div>
      </div>

      {/* Filter Bar with Search, Type Dropdown, Category Dropdown, and Active Chips */}
      <FilterBar
        activeFilters={[
          ...(assetType ? [{ key: 'assetType', label: 'Type', value: assetType }] : []),
          ...(categoryId ? [{ key: 'categoryId', label: 'Category', value: categories.find((c) => c.id === categoryId)?.name || categoryId }] : []),
          ...(status !== 'ACTIVE' ? [{ key: 'status', label: 'Status', value: status }] : []),
        ]}
        onRemoveFilter={(key) => updateParams({ [key]: undefined, page: 1 })}
        onResetFilters={() => updateParams({ q: undefined, assetType: undefined, categoryId: undefined, status: 'ACTIVE', page: 1 })}
      >
        <SearchInput
          value={q}
          onChange={(newQ) => updateParams({ q: newQ, page: 1 })}
          placeholder="Search by asset name, code..."
          className="w-full sm:w-64"
        />

        <select
          value={assetType}
          onChange={(e) => updateParams({ assetType: e.target.value || undefined, page: 1 })}
          aria-label="Filter by asset type"
          className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Types</option>
          <option value="SOFTWARE">Software</option>
          <option value="DOCUMENT">Document</option>
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
          <option value="DATASET">Dataset</option>
          <option value="FONT">Font</option>
        </select>

        <select
          value={categoryId}
          onChange={(e) => updateParams({ categoryId: e.target.value || undefined, page: 1 })}
          aria-label="Filter by category"
          className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 max-w-[160px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* View Trash / Active Selector */}
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
          aria-label="Filter by status"
          className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="ACTIVE">Active Assets</option>
          <option value="ARCHIVED">Trash / Archived</option>
        </select>

        {/* Grid vs Table Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-xs' : 'text-slate-400'}`}
            title="Table View"
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-xs' : 'text-slate-400'}`}
            title="Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </FilterBar>

      {isError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            {(error as any)?.message || 'Failed to load digital assets repository.'}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid View Mode */}
      {viewMode === 'grid' && !isLoading && assets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.asset_id || asset.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                    {asset.asset_code || asset.assetCode}
                  </span>
                  <StatusBadge status={asset.compliance_status || 'COMPLIANT'} size="sm" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                  {asset.asset_name || asset.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                  {asset.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">v{asset.latest_version_no || 1}</span>
                <Link
                  to={`/assets/${asset.asset_id || asset.id}`}
                  className="font-semibold text-primary-600 hover:underline flex items-center gap-1"
                >
                  Manage &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View Mode */
        <DataTable
          columns={columns}
          data={assets}
          meta={meta}
          isLoading={isLoading}
          sortBy={sort}
          sortOrder={order}
          onSort={(key) => {
            const nextOrder = sort === key && order === 'asc' ? 'desc' : 'asc';
            updateParams({ sort: key, order: nextOrder });
          }}
          onPageChange={(p) => updateParams({ page: p })}
          onLimitChange={(l) => updateParams({ limit: l, page: 1 })}
          keyExtractor={(row) => row.asset_id || row.id}
          onRowClick={(row) => navigate(`/assets/${row.asset_id || row.id}`)}
          emptyTitle="No assets found"
          emptyMessage="No digital assets matched your filters or query."
          emptyAction={{
            label: 'Add New Asset',
            onClick: () => setShowCreateModal(true),
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      )}

      {/* Modal: Create Asset */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateErrors({}); }}
        title="Create Digital Asset"
        description="Provision a new digital asset in the repository with initial version control"
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setShowCreateModal(false); setCreateErrors({}); }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createAssetMutation.isPending}
              onClick={() => {
                const errors: Record<string, string> = {};
                if (!createForm.name.trim() || createForm.name.trim().length < 2) {
                  errors.name = 'Asset name must be at least 2 characters.';
                }
                if (!createForm.assetCode.trim() || createForm.assetCode.trim().length < 2) {
                  errors.assetCode = 'Asset code must be at least 2 characters.';
                }
                if (!createForm.fileUrl.trim()) {
                  errors.fileUrl = 'Initial file URL is required.';
                } else if (!/^https?:\/\/.+/.test(createForm.fileUrl.trim())) {
                  errors.fileUrl = 'Please enter a valid HTTP/HTTPS URL.';
                }

                if (Object.keys(errors).length > 0) {
                  setCreateErrors(errors);
                  return;
                }
                setCreateErrors({});
                createAssetMutation.mutate(createForm);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {createAssetMutation.isPending ? 'Creating...' : 'Create Asset'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Asset Name" required error={createErrors.name}>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => {
                setCreateForm({ ...createForm, name: e.target.value });
                if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. Core Design System Tokens"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Asset Code (SKU)" required error={createErrors.assetCode}>
              <input
                type="text"
                value={createForm.assetCode}
                onChange={(e) => {
                  setCreateForm({ ...createForm, assetCode: e.target.value });
                  if (createErrors.assetCode) setCreateErrors((prev) => ({ ...prev, assetCode: '' }));
                }}
                placeholder="AST-TOKENS-01"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </FormField>

            <FormField label="Asset Type" required>
              <select
                value={createForm.assetType}
                onChange={(e) => setCreateForm({ ...createForm, assetType: e.target.value as AssetType })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="SOFTWARE">Software</option>
                <option value="DOCUMENT">Document</option>
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
                <option value="DATASET">Dataset</option>
                <option value="FONT">Font</option>
              </select>
            </FormField>
          </div>

          <FormField label="Category">
            <select
              value={createForm.categoryId}
              onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <div>
            <FileUrlField
              label="Initial File URL"
              required
              helperText="CDN / Object Storage URL for version 1"
              value={createForm.fileUrl}
              onChange={(val) => {
                setCreateForm({ ...createForm, fileUrl: val });
                if (createErrors.fileUrl) setCreateErrors((prev) => ({ ...prev, fileUrl: '' }));
              }}
              placeholder="https://cdn.assetvault.io/tokens-v1.json"
            />
            {createErrors.fileUrl && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{createErrors.fileUrl}</p>
            )}
          </div>

          <FormField label="Tags">
            <TagInput
              tags={createForm.tags}
              onChange={(tags) => setCreateForm({ ...createForm, tags })}
              placeholder="Type tag and press Enter..."
            />
          </FormField>
        </div>
      </Modal>

      {/* Modal: Bulk CSV Import with Preview & Rollback guarantee */}
      <Modal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        title="All-or-Nothing Bulk CSV Import"
        description="Upload CSV containing asset_code, name, asset_type, and description. Transactions roll back entirely on any error."
        maxWidth="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCsvModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!csvContent || bulkImportMutation.isPending}
              onClick={() => bulkImportMutation.mutate(csvContent)}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {bulkImportMutation.isPending ? 'Importing Atomic Batch...' : 'Execute Import'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-primary-500 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select or drop your CSV file here
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              Must include headers: asset_code, name, asset_type, description
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-950 dark:file:text-primary-300 cursor-pointer"
            />
          </div>

          {csvPreviewRows.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
                Preview (First {csvPreviewRows.length} Rows)
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {csvPreviewRows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-mono">{r.assetCode}</td>
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.assetType}</td>
                        <td className="p-2 text-slate-400 truncate max-w-xs">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Soft Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAssetTarget}
        onClose={() => setDeleteAssetTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteAssetTarget?.asset_id || deleteAssetTarget?.id)}
        title="Move Asset to Trash"
        message={`Are you sure you want to move "${deleteAssetTarget?.asset_name || deleteAssetTarget?.name}" to trash? You can restore it later from the Archived filter.`}
        confirmLabel="Move to Trash"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
