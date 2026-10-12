import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { LicenseAllocation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Users2, ShieldAlert, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';

export const AllocationListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [revokeReason, setRevokeReason] = useState('');
  const [selectedAllocation, setSelectedAllocation] = useState<LicenseAllocation | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const { data: allocationsData, isLoading } = useQuery<{ data: LicenseAllocation[] }>({
    queryKey: ['allocations'],
    queryFn: () => api.get('/allocations', { params: { limit: 100 } }),
  });

  const canManage = user?.role === 'tenant_admin' || user?.role === 'asset_manager' || user?.isSuperAdmin;

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/allocations/${id}/revoke`, { reason }),
    onSuccess: () => {
      setSelectedAllocation(null);
      setRevokeReason('');
      setNotice({ text: 'License seat revoked successfully and capacity restored.' });
      setTimeout(() => setNotice(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
    onError: (err: any) => {
      setNotice({ text: err.message || 'Failed to revoke seat.', error: true });
    },
  });

  const allocations = allocationsData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Active License Allocations</h1>
        <p className="text-xs text-slate-400 mt-1">
          Detailed seat distribution matrix tracking user software provisioning and compliance.
        </p>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
            notice.error
              ? 'bg-red-950/60 border-red-800 text-red-300'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}
        >
          {notice.error ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : allocations.length === 0 ? (
          <div className="py-16 text-center">
            <Users2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No active allocations</p>
            <p className="text-xs text-slate-500 mt-1">
              Allocate seats from the Licenses & Quotas page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">User</th>
                  <th className="px-6 py-3.5 font-semibold">Allocated License</th>
                  <th className="px-6 py-3.5 font-semibold">Vendor</th>
                  <th className="px-6 py-3.5 font-semibold">Allocated At</th>
                  <th className="px-6 py-3.5 font-semibold">Status</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {alloc.user?.avatarUrl ? (
                          <img
                            src={alloc.user.avatarUrl}
                            alt=""
                            className="w-7 h-7 rounded-full bg-slate-800"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                            {alloc.user?.fullName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white">{alloc.user?.fullName}</p>
                          <p className="text-[11px] text-slate-400">{alloc.user?.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div className="flex items-center space-x-2">
                        <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                        <span>{alloc.license?.name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-400">
                      {alloc.license?.vendor?.name || 'Commercial'}
                    </td>

                    <td className="px-6 py-4 text-slate-400">
                      {new Date(alloc.allocatedAt).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4">
                      {alloc.revokedAt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                          Revoked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active Seat
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {canManage && !alloc.revokedAt && (
                        <button
                          onClick={() => setSelectedAllocation(alloc)}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-semibold transition"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Seat Confirmation Modal */}
      {selectedAllocation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-2 text-red-400 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Revoke License Seat</h3>
            </div>
            <p className="text-xs text-slate-400">
              Are you sure you want to reclaim the seat for{' '}
              <strong className="text-white">{selectedAllocation.license?.name}</strong> from{' '}
              <strong className="text-white">{selectedAllocation.user?.fullName}</strong>?
            </p>

            <div className="mt-4">
              <label className="block text-[11px] text-slate-300 font-medium mb-1">
                Revocation Reason (Optional)
              </label>
              <input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Project offboarding, Role transition"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedAllocation(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  revokeMutation.mutate({
                    id: selectedAllocation.id,
                    reason: revokeReason,
                  })
                }
                disabled={revokeMutation.isPending}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-600/30"
              >
                {revokeMutation.isPending ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
