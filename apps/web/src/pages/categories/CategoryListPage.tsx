import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Category } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FolderTree, Plus, Trash2, X, AlertCircle } from 'lucide-react';

export const CategoryListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', parentCategoryId: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: categoriesData, isLoading } = useQuery<{ data: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const canManage = user?.role === 'tenant_admin' || user?.role === 'asset_manager' || user?.isSuperAdmin;

  const createMutation = useMutation({
    mutationFn: (newCat: any) =>
      api.post('/categories', {
        ...newCat,
        parentCategoryId: newCat.parentCategoryId || undefined,
      }),
    onSuccess: () => {
      setShowModal(false);
      setForm({ name: '', description: '', parentCategoryId: '' });
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create category.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Cannot delete category with associated assets.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const categories = categoriesData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Category Taxonomy</h1>
          <p className="text-xs text-slate-400 mt-1">
            Hierarchical asset classifications and taxonomic structures.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <FolderTree className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No categories found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-white text-sm">{cat.name}</h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {cat._count?.assets || 0} assets
                  </span>
                </div>

                {cat.parentCategory && (
                  <p className="text-[11px] text-blue-400 mt-1">
                    ↳ Sub-category of: <strong>{cat.parentCategory.name}</strong>
                  </p>
                )}

                <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                  {cat.description || 'No description provided.'}
                </p>
              </div>

              {canManage && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm(`Remove category "${cat.name}"?`)) {
                        deleteMutation.mutate(cat.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Create Classification Category</h2>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Category Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Computer Vision Datasets"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Parent Category (Optional - For Hierarchies)
                </label>
                <select
                  value={form.parentCategoryId}
                  onChange={(e) => setForm({ ...form, parentCategoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Categorization guidelines..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
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
                  {createMutation.isPending ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
