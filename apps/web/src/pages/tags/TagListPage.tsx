import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Tag } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Tags, Plus, Trash2, X, AlertCircle } from 'lucide-react';

export const TagListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', colorHex: '#3B82F6' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: tagsData, isLoading } = useQuery<{ data: Tag[] }>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags'),
  });

  const canManage = user?.role === 'tenant_admin' || user?.role === 'asset_manager' || user?.isSuperAdmin;

  const createMutation = useMutation({
    mutationFn: (newTag: any) => api.post('/tags', newTag),
    onSuccess: () => {
      setShowModal(false);
      setForm({ name: '', colorHex: '#3B82F6' });
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create tag.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete tag.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const tags = tagsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tagging Vocabulary</h1>
          <p className="text-xs text-slate-400 mt-1">
            Taxonomic metadata labels applied across digital assets.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tag</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : tags.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <Tags className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No tags defined</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center space-x-2.5">
                <span
                  style={{ backgroundColor: tag.colorHex }}
                  className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-slate-800 shadow"
                />
                <div>
                  <p className="text-xs font-bold text-white leading-tight">#{tag.name}</p>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {tag._count?.assetTags || 0} uses
                  </span>
                </div>
              </div>

              {canManage && (
                <button
                  onClick={() => {
                    if (confirm(`Delete tag "${tag.name}"?`)) {
                      deleteMutation.mutate(tag.id);
                    }
                  }}
                  className="p-1 text-slate-500 hover:text-red-400 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Tag Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Create Tag Label</h2>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Tag Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().trim() })}
                  placeholder="e.g. production, ai-dataset"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Color Palette (Hex)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                  />
                  <input
                    value={form.colorHex}
                    onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
