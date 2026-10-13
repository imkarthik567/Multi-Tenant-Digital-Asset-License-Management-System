// ==============================================================================
// AssetVault: License Catalog & Quota Tracking
// Course: BCSE307L Database Systems (Fall 2026-27)
// Multi-tenant software contract inventory, seat utilization & renewals
// ==============================================================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { License, Vendor, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound,
  Plus,
  Users2,
  Trash2,
  Calendar,
  DollarSign,
  AlertCircle,
  X,
  CheckCircle,
  Building,
  Search,
  ExternalLink,
} from 'lucide-react';

export const LicenseListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Creation form state matching backend createLicenseSchema
  const [createForm, setCreateForm] = useState({
    name: '',
    vendorId: '',
    licenseTypeId: 1,
    licenseKey: '',
    totalSeats: 10,
    cost: 499.0,
    currency: 'USD',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    autoRenew: true,
  });

  const { data: licensesData, isLoading } = useQuery<{ data: License[]; meta: any }>({
    queryKey: ['licenses', searchTerm],
    queryFn: () => api.get('/licenses', { params: { limit: 50, q: searchTerm || undefined } }),
  });

  const { data: vendorsData } = useQuery<{ data: Vendor[] }>({
    queryKey: ['vendors-dropdown'],
    queryFn: () => api.get('/vendors'),
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users-dropdown'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
  });

  const canManage =
    user?.role === 'TENANT_ADMIN' ||
    user?.role === 'ASSET_MANAGER' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.isSuperAdmin;

  // Allocate Seat mutation
  const allocateSeatMutation = useMutation({
    mutationFn: (payload: { licenseId: string; userId: string; notes?: string }) =>
      api.post(`/licenses/${payload.licenseId}/allocate`, { userId: payload.userId, notes: payload.notes }),
    onSuccess: () => {
      setShowAllocateModal(false);
      setSelectedUserId('');
      setAllocationNotes('');
      setActionMessage({ text: 'License seat allocated successfully via sp_allocate_license_seat!' });
      setTimeout(() => setActionMessage(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
    onError: (err: any) => {
      setActionMessage({ text: err.message || 'Seat allocation failed.', error: true });
    },
  });

  // Create License mutation
  const createLicenseMutation = useMutation({
    mutationFn: (newLicense: typeof createForm) => api.post('/licenses', newLicense),
    onSuccess: () => {
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setActionMessage({ text: 'License created successfully.' });
      setTimeout(() => setActionMessage(null), 4000);
      setCreateForm({
        name: '',
        vendorId: '',
        licenseTypeId: 1,
        licenseKey: '',
        totalSeats: 10,
        cost: 499.0,
        currency: 'USD',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        autoRenew: true,
      });
    },
    onError: (err: any) => {
      setActionMessage({ text: err.message || 'Failed to create license.', error: true });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/licenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setActionMessage({ text: 'License soft-deleted.' });
      setTimeout(() => setActionMessage(null), 4000);
    },
  });

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !selectedUserId) return;
    allocateSeatMutation.mutate({
      licenseId: selectedLicense.id,
      userId: selectedUserId,
      notes: allocationNotes,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLicenseMutation.mutate(createForm);
  };

  const licenses = licensesData?.data || [];
  const vendors = vendorsData?.data || [];
  const members = usersData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Software & Asset Licenses</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Contract quotas, seat allocations, expiration schedules, and vendor compliance.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search licenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary-600/30 transition flex items-center space-x-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create License</span>
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
            actionMessage.error
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {actionMessage.error ? (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* License Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : licenses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <KeyRound className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No licenses found</p>
          <p className="text-xs text-slate-500 mt-1">Add software contracts to track seat availability and compliance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {licenses.map((licItem) => {
            const lic = licItem as any;
            const licId = lic.id || lic.license_id;
            const licName = lic.name || lic.license_name || 'Unnamed License';
            const vendorName = lic.vendor?.name || lic.vendor_name || 'Unknown Vendor';
            const licTypeName = lic.licenseType?.name || lic.license_type || 'Standard';
            const isUnlimited = licTypeName === 'SITE_LICENSE' || lic.licenseType?.isSeatBased === false;
            const allocated = Number(lic.used_seats ?? lic.usedSeats ?? (lic.allocations ? lic.allocations.filter((a: any) => a.status === 'ACTIVE').length : 0));
            const total = Number(lic.total_seats ?? lic.totalSeats ?? 1);
            const pct = isUnlimited ? 100 : Math.min(100, Math.round((allocated / total) * 100));
            const endDateVal = lic.endDate || lic.end_date;
            const costVal = typeof lic.cost === 'object' && lic.cost?.d ? (lic.cost.d[0] / (lic.cost.s === 1 ? 1 : 1)) : Number(lic.cost || 0);

            return (
              <div
                key={licId}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-500/20">
                      {licTypeName}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        lic.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                      }`}
                    >
                      {lic.status}
                    </span>
                  </div>

                  <div className="flex items-start justify-between mt-3">
                    <Link to={`/licenses/${licId}`} className="group">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition flex items-center gap-1.5">
                        {licName}
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    </Link>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{vendorName}</span>
                  </div>

                  {/* Seat Capacity Progress */}
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Seat Utilization:</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {isUnlimited ? 'Unlimited (Site License)' : `${allocated} / ${total} seats (${pct}%)`}
                      </span>
                    </div>

                    {!isUnlimited && (
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
                            pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary-500'
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Expiration and Cost */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {endDateVal
                          ? `Expires: ${new Date(endDateVal).toLocaleDateString()}`
                          : 'Perpetual Contract'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 justify-end">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        ${Number(costVal).toFixed(2)} {lic.currency || 'USD'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {lic.assetLicenses?.length || 0} linked asset(s)
                  </span>

                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/licenses/${licId}`}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Details
                    </Link>

                    {canManage && (
                      <button
                        onClick={() => {
                          setSelectedLicense(lic);
                          setShowAllocateModal(true);
                        }}
                        disabled={!isUnlimited && allocated >= total}
                        className="px-3 py-1.5 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/30 rounded-xl text-xs font-semibold disabled:opacity-40 flex items-center space-x-1.5 transition"
                      >
                        <Users2 className="w-3.5 h-3.5" />
                        <span>Allocate</span>
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Soft-delete license "${lic.name}"?`)) {
                            deleteMutation.mutate(lic.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title="Delete License"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Allocate Seat Modal */}
      {showAllocateModal && selectedLicense && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAllocateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-900 dark:text-white">Allocate Seat</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Assign a license seat for <strong className="text-slate-900 dark:text-white">{selectedLicense.name}</strong>
            </p>

            <form onSubmit={handleAllocateSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Select Member</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Choose an employee...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Assignment Notes</label>
                <input
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  placeholder="e.g. Workstation ID, Project authorization code"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocateSeatMutation.isPending}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/30"
                >
                  {allocateSeatMutation.isPending ? 'Allocating...' : 'Confirm Seat Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create License Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Register New License Contract</h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">License Name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Adobe Creative Cloud Enterprise"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Vendor</label>
                  <select
                    required
                    value={createForm.vendorId}
                    onChange={(e) => setCreateForm({ ...createForm, vendorId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Licensing Model</label>
                  <select
                    value={createForm.licenseTypeId}
                    onChange={(e) => setCreateForm({ ...createForm, licenseTypeId: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value={1}>Proprietary Commercial (Per-Seat)</option>
                    <option value={2}>Open Source (Unlimited)</option>
                    <option value={3}>Site License (Unlimited Enterprise)</option>
                    <option value={4}>Perpetual (Fixed Cap)</option>
                    <option value={5}>SaaS Subscription</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Total Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.totalSeats}
                    onChange={(e) => setCreateForm({ ...createForm, totalSeats: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={createForm.cost}
                    onChange={(e) => setCreateForm({ ...createForm, cost: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">License Key / Secret Code</label>
                <input
                  required
                  value={createForm.licenseKey}
                  onChange={(e) => setCreateForm({ ...createForm, licenseKey: e.target.value })}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLicenseMutation.isPending}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium shadow-lg shadow-primary-600/30"
                >
                  {createLicenseMutation.isPending ? 'Creating...' : 'Create License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
