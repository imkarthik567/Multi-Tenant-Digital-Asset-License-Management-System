// ==============================================================================
// AssetVault: Software & Asset Vendors Management
// Course: BCSE307L Database Systems (Fall 2026-27)
// Supplier directory, contract contacts, and procurement channels
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Plus,
  Mail,
  Phone,
  Globe,
  Trash2,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { Vendor } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { RoleGate } from '../../components/auth/RoleGate';

export const VendorListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();


  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);

  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    website: '',
    supportPhone: '',
  });

  // Fetch Vendors
  const { data: vendorsData, isLoading } = useQuery<{ data: Vendor[]; meta?: any }>({
    queryKey: ['vendors', search],
    queryFn: async () => {
      const res = await api.get<{ data: Vendor[]; meta: any }>('/vendors', {
        params: { q: search || undefined, limit: 50 },
      });
      return res;
    },
  });

  // MUTATIONS
  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        name: data.name,
        contactEmail: data.contactEmail || undefined,
        website: data.website || undefined,
        supportPhone: data.supportPhone || undefined,
      };
      if (editingVendor) {
        return api.patch(`/vendors/${editingVendor.id}`, payload);
      }
      return api.post('/vendors', payload);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        message: editingVendor ? 'Vendor details updated' : 'Vendor created successfully',
        type: 'success',
      });
      setIsModalOpen(false);
      setEditingVendor(null);
      setForm({ name: '', contactEmail: '', website: '', supportPhone: '' });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Vendor Error',
        message: err.message || 'Operation failed. Vendor name must be unique within tenant.',
        type: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/${id}`),
    onSuccess: () => {
      toast({ title: 'Vendor Removed', message: 'Vendor record deleted', type: 'info' });
      setDeleteVendor(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Cannot Delete Vendor',
        message: err.message || 'Vendor is tied to existing software licenses.',
        type: 'error',
      });
    },
  });

  const vendors = vendorsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <Store className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Software & Asset Vendors
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supplier accounts, contact directories, and procurement channels.
          </p>
        </div>

        <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
          <button
            onClick={() => {
              setEditingVendor(null);
              setForm({ name: '', contactEmail: '', website: '', supportPhone: '' });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Vendor
          </button>
        </RoleGate>
      </div>

      {/* Search Input */}
      <div className="w-full sm:w-72">
        <SearchInput value={search} onChange={setSearch} placeholder="Search vendors..." />
      </div>

      {/* Vendors Grid */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : vendors.length === 0 ? (
        <EmptyState
          title="No Vendors Found"
          message="No software suppliers or asset vendors registered yet."
          action={{
            label: 'Add First Vendor',
            onClick: () => {
              setEditingVendor(null);
              setForm({ name: '', contactEmail: '', website: '', supportPhone: '' });
              setIsModalOpen(true);
            },
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{v.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                    {v._count?.licenses ?? 0} licenses
                  </span>
                </div>

                {/* Contact Information */}
                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {v.contactEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`mailto:${v.contactEmail}`} className="hover:underline truncate">
                        {v.contactEmail}
                      </a>
                    </div>
                  )}
                  {v.supportPhone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{v.supportPhone}</span>
                    </div>
                  )}
                  {v.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <a
                        href={v.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center text-primary-600 dark:text-primary-400 truncate"
                      >
                        {v.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setEditingVendor(v);
                      setForm({
                        name: v.name,
                        contactEmail: v.contactEmail || '',
                        website: v.website || '',
                        supportPhone: v.supportPhone || '',
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    title="Edit Vendor"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteVendor(v)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded"
                    title="Delete Vendor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </RoleGate>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT VENDOR MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(form);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Vendor Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Adobe Systems, JetBrains"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Contact Email</label>
            <input
              type="email"
              placeholder="licensing@vendor.com"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Support Phone</label>
            <input
              type="text"
              placeholder="+1 (800) 555-0199"
              value={form.supportPhone}
              onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Website URL</label>
            <input
              type="url"
              placeholder="https://www.vendor.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deleteVendor}
        onClose={() => setDeleteVendor(null)}
        onConfirm={() => deleteMutation.mutate(deleteVendor!.id)}
        title="Delete Vendor Record"
        message={`Are you sure you want to delete vendor "${deleteVendor?.name}"? Deletion will be rejected if existing licenses are linked to this supplier.`}
        confirmText="Delete Vendor"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
