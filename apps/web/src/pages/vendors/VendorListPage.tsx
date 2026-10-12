import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Vendor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Building, Plus, Mail, Phone, Globe, Trash2, X, AlertCircle } from 'lucide-react';

export const VendorListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    address: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: vendorsData, isLoading } = useQuery<{ data: Vendor[] }>({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors'),
  });

  const canManage = user?.role === 'tenant_admin' || user?.role === 'asset_manager' || user?.isSuperAdmin;

  const createMutation = useMutation({
    mutationFn: (newVendor: any) => api.post('/vendors', newVendor),
    onSuccess: () => {
      setShowModal(false);
      setForm({ name: '', contactEmail: '', contactPhone: '', websiteUrl: '', address: '' });
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create vendor.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Cannot delete vendor with associated licenses.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const vendors = vendorsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Software & Asset Vendors</h1>
          <p className="text-xs text-slate-400 mt-1">
            Supplier accounts, contact directories, and procurement contacts.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <Building className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No vendors registered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-white text-sm">{v.name}</h3>
                  <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {v._count?.licenses || 0} licenses
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                  {v.contactEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{v.contactEmail}</span>
                    </div>
                  )}
                  {v.contactPhone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{v.contactPhone}</span>
                    </div>
                  )}
                  {v.websiteUrl && (
                    <div className="flex items-center space-x-2">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <a
                        href={v.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline truncate"
                      >
                        {v.websiteUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm(`Remove vendor "${v.name}"?`)) {
                        deleteMutation.mutate(v.id);
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

      {/* Add Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Add Commercial Vendor</h2>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Company / Vendor Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. JetBrains, Adobe Systems"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Representative Email</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="sales@vendor.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Website URL</label>
                <input
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://..."
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
                  {createMutation.isPending ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
