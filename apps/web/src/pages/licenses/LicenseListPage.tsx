import React, { useState } from 'react';
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
} from 'lucide-react';

export const LicenseListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Creation form state
  const [createForm, setCreateForm] = useState({
    vendorId: '',
    name: '',
    licenseKey: '',
    licenseType: 'per_seat',
    totalSeats: 10,
    cost: 499.0,
    currency: 'USD',
    startsAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isAutoRenew: true,
    renewalReminderDays: 30,
    status: 'active',
  });

  const { data: licensesData, isLoading } = useQuery<{ data: License[]; meta: any }>({
    queryKey: ['licenses'],
    queryFn: () => api.get('/licenses', { params: { limit: 50 } }),
  });

  const { data: vendorsData } = useQuery<{ data: Vendor[] }>({
    queryKey: ['vendors-dropdown'],
    queryFn: () => api.get('/vendors'),
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users-dropdown'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
  });

  const canManage = user?.role === 'tenant_admin' || user?.role === 'asset_manager' || user?.isSuperAdmin;

  // Allocate Seat mutation
  const allocateSeatMutation = useMutation({
    mutationFn: (payload: { licenseId: string; userId: string; notes?: string }) =>
      api.post('/allocations', payload),
    onSuccess: () => {
      setShowAllocateModal(false);
      setSelectedUserId('');
      setAllocationNotes('');
      setActionMessage({ text: 'License seat allocated successfully!' });
      setTimeout(() => setActionMessage(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
    onError: (err: any) => {
      setActionMessage({ text: err.message || 'Seat allocation failed.', error: true });
    },
  });

  // Create License mutation
  const createLicenseMutation = useMutation({
    mutationFn: (newLicense: any) => api.post('/licenses', newLicense),
    onSuccess: () => {
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setActionMessage({ text: 'License created successfully.' });
      setTimeout(() => setActionMessage(null), 4000);
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Software & Asset Licenses</h1>
          <p className="text-xs text-slate-400 mt-1">
            Contract quotas, seat allocations, expiration schedules, and vendor compliance.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create License</span>
          </button>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
            actionMessage.error
              ? 'bg-red-950/60 border-red-800 text-red-300'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}
        >
          {actionMessage.error ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Licenses Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : licenses.length === 0 ? (
        <div className="py-20 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <KeyRound className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No licenses configured</p>
          <p className="text-xs text-slate-500 mt-1">Add software contracts to track seat availability.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {licenses.map((lic) => {
            const isUnlimited = lic.licenseType === 'site' || lic.licenseType === 'open_source';
            const allocated = lic.allocatedSeats || 0;
            const total = lic.totalSeats || 1;
            const pct = isUnlimited ? 100 : Math.min(100, Math.round((allocated / total) * 100));

            return (
              <div
                key={lic.id}
                className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      {lic.licenseType.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        lic.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {lic.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-3">{lic.name}</h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    <span>{lic.vendor?.name || 'Unknown Vendor'}</span>
                  </div>

                  {/* Seat Capacity Progress */}
                  <div className="mt-4 p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Seat Utilization:</span>
                      <span className="font-bold text-white font-mono">
                        {isUnlimited ? 'Unlimited (Site License)' : `${allocated} / ${total} seats (${pct}%)`}
                      </span>
                    </div>

                    {!isUnlimited && (
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
                            pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Expiration and Cost */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {lic.expiresAt
                          ? `Expires: ${new Date(lic.expiresAt).toLocaleDateString()}`
                          : 'Perpetual Contract'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-400 justify-end">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono text-slate-200">
                        ${Number(lic.cost).toFixed(2)} {lic.currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {lic.linkedAssetCount || 0} linked asset(s)
                  </span>

                  <div className="flex items-center space-x-2">
                    {canManage && (
                      <button
                        onClick={() => {
                          setSelectedLicense(lic);
                          setShowAllocateModal(true);
                        }}
                        disabled={!isUnlimited && allocated >= total}
                        className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold disabled:opacity-40 flex items-center space-x-1.5 transition"
                      >
                        <Users2 className="w-3.5 h-3.5" />
                        <span>Allocate Seat</span>
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => {
                          if (confirm(`Soft-delete license "${lic.name}"?`)) {
                            deleteMutation.mutate(lic.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAllocateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white">Allocate Seat</h2>
            <p className="text-xs text-slate-400 mt-1">
              Assign a license seat for <strong className="text-white">{selectedLicense.name}</strong>
            </p>

            <form onSubmit={handleAllocateSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Member</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
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
                <label className="block text-slate-300 font-medium mb-1">Assignment Notes</label>
                <input
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  placeholder="e.g. Workstation ID, Project authorization code"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocateSeatMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Register New License Contract</h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">License Name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Adobe Creative Cloud Enterprise"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Vendor</label>
                  <select
                    required
                    value={createForm.vendorId}
                    onChange={(e) => setCreateForm({ ...createForm, vendorId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
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
                  <label className="block text-slate-300 font-medium mb-1">Licensing Model</label>
                  <select
                    value={createForm.licenseType}
                    onChange={(e) => setCreateForm({ ...createForm, licenseType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="per_seat">Per Seat</option>
                    <option value="site">Site License (Unlimited)</option>
                    <option value="subscription">Subscription</option>
                    <option value="perpetual">Perpetual</option>
                    <option value="open_source">Open Source</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Total Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.totalSeats}
                    onChange={(e) => setCreateForm({ ...createForm, totalSeats: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={createForm.cost}
                    onChange={(e) => setCreateForm({ ...createForm, cost: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">License Key / Code (Optional)</label>
                <input
                  value={createForm.licenseKey}
                  onChange={(e) => setCreateForm({ ...createForm, licenseKey: e.target.value })}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none font-mono"
                />
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
                  disabled={createLicenseMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-600/30"
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
