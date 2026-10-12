import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Asset, Category, Tag } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  FolderArchive,
  Search,
  Plus,
  Download,
  Eye,
  Trash2,
  X,
  CheckCircle,
} from 'lucide-react';

export const AssetListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  // Form states for creation
  const [createForm, setCreateForm] = useState({
    name: '',
    categoryId: '',
    assetType: 'software',
    description: '',
    fileUrl: '',
    fileSizeBytes: 1048576,
    version: '1.0.0',
    tagIds: [] as string[],
    licenseIds: [] as string[],
  });

  const { data: assetsData, isLoading } = useQuery<{ data: Asset[]; meta: any }>({
    queryKey: ['assets', search, selectedType, selectedCategory, page],
    queryFn: () =>
      api.get('/assets', {
        params: {
          q: search,
          assetType: selectedType || undefined,
          categoryId: selectedCategory || undefined,
          page,
          limit: 12,
        },
      }),
  });

  const { data: categoriesData } = useQuery<{ data: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const { data: tagsData } = useQuery<{ data: Tag[] }>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags'),
  });

  const canManage = user?.role === 'tenant_admin' || user?.role === 'asset_manager' || user?.isSuperAdmin;

  // Log Access mutation
  const logAccessMutation = useMutation({
    mutationFn: ({ assetId, action }: { assetId: string; action: string }) =>
      api.post(`/assets/${assetId}/access`, { action }),
    onSuccess: (_, vars) => {
      setAccessNotice(`Action recorded: ${vars.action.toUpperCase()} logged in access history.`);
      setTimeout(() => setAccessNotice(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });

  // Create Asset mutation
  const createAssetMutation = useMutation({
    mutationFn: (newAsset: any) => api.post('/assets', newAsset),
    onSuccess: () => {
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setCreateForm({
        name: '',
        categoryId: '',
        assetType: 'software',
        description: '',
        fileUrl: '',
        fileSizeBytes: 1048576,
        version: '1.0.0',
        tagIds: [],
        licenseIds: [],
      });
    },
  });

  // Soft delete mutation
  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => api.delete(`/assets/${assetId}`),
    onSuccess: () => {
      setSelectedAsset(null);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAssetMutation.mutate(createForm);
  };

  const assets = assetsData?.data || [];
  const meta = assetsData?.meta;
  const categories = categoriesData?.data || [];
  const tags = tagsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Digital Asset Repository</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and manage fonts, software packages, datasets, media, and license associations.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Register Asset</span>
          </button>
        )}
      </div>

      {accessNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{accessNotice}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search assets by name or description..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Asset Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="font">Fonts</option>
            <option value="software">Software Binaries</option>
            <option value="dataset">Datasets</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="document">Documents</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <FolderArchive className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No assets found</p>
          <p className="text-xs text-slate-500 mt-1">Try refining your search terms or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col justify-between transition group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {asset.assetType}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">v{asset.version}</span>
                </div>

                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-blue-400 transition line-clamp-1">
                  {asset.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 h-8">
                  {asset.description || 'No description provided.'}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {asset.assetTags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      style={{ borderColor: `${tag.colorHex}40`, color: tag.colorHex }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 border"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {asset.category?.name || 'Uncategorized'}
                </span>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      logAccessMutation.mutate({ assetId: asset.id, action: 'view' });
                      setSelectedAsset(asset);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                    title="View Asset Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      logAccessMutation.mutate({ assetId: asset.id, action: 'download' });
                      alert(`Download initiated for: ${asset.name}. Logged in asset_access_logs.`);
                    }}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                    title="Download Asset"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {canManage && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to soft-delete "${asset.name}"?`)) {
                          deleteMutation.mutate(asset.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                      title="Soft Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-between items-center pt-4">
          <span className="text-xs text-slate-400">
            Page {meta.page} of {meta.totalPages} ({meta.total} total assets)
          </span>
          <div className="flex space-x-2">
            <button
              disabled={!meta.hasPrev}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={!meta.hasNext}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              {selectedAsset.assetType}
            </span>
            <h2 className="text-lg font-bold text-white mt-2">{selectedAsset.name}</h2>
            <p className="text-xs text-slate-400 mt-1">{selectedAsset.description}</p>

            <div className="mt-4 p-3 bg-slate-800/50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="text-slate-200">{selectedAsset.category?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Version:</span>
                <span className="text-slate-200 font-mono">v{selectedAsset.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Storage URI:</span>
                <span className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]">
                  {selectedAsset.fileUrl || 'External / Unhosted'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Covering Licenses:</span>
                <span className="text-blue-400 font-semibold">
                  {selectedAsset.assetLicenses?.length || 0} active license(s)
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Asset Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Register New Digital Asset</h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Asset Name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. JetBrains IntelliJ 2026 Binary"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Asset Type</label>
                  <select
                    value={createForm.assetType}
                    onChange={(e) => setCreateForm({ ...createForm, assetType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="software">Software</option>
                    <option value="font">Font</option>
                    <option value="dataset">Dataset</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    required
                    value={createForm.categoryId}
                    onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">File Storage URL</label>
                <input
                  value={createForm.fileUrl}
                  onChange={(e) => setCreateForm({ ...createForm, fileUrl: e.target.value })}
                  placeholder="https://storage.internal/assets/..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Technical specifications, author or licensing conditions..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assign Tags</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800/50 rounded-xl border border-slate-700">
                  {tags.map((t) => {
                    const isSelected = createForm.tagIds.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          const tagIds = isSelected
                            ? createForm.tagIds.filter((id) => id !== t.id)
                            : [...createForm.tagIds, t.id];
                          setCreateForm({ ...createForm, tagIds });
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        #{t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAssetMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-600/30"
                >
                  {createAssetMutation.isPending ? 'Registering...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
