import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { ScrollText, Eye, X } from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);

  const { data: logsData, isLoading } = useQuery<{ data: AuditLog[]; meta: any }>({
    queryKey: ['audit-logs', selectedAction, page],
    queryFn: () =>
      api.get('/audit-logs', {
        params: {
          action: selectedAction || undefined,
          page,
          limit: 20,
        },
      }),
  });

  const logs = logsData?.data || [];

  const actions = ['CREATE', 'UPDATE', 'DELETE', 'ALLOCATE', 'REVOKE', 'LOGIN', 'LOGOUT'];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'UPDATE':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DELETE':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'ALLOCATE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'REVOKE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Compliance & Audit Trail</h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable ledger of security events, administrative mutations, and seat allocations.
        </p>
      </div>

      {/* Action Filter Pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => {
            setSelectedAction('');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            selectedAction === ''
              ? 'bg-blue-600 text-white shadow'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All Events
        </button>
        {actions.map((act) => (
          <button
            key={act}
            onClick={() => {
              setSelectedAction(act);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition font-mono ${
              selectedAction === act
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {act}
          </button>
        ))}
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No audit events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-6 py-3.5 font-semibold">Actor</th>
                  <th className="px-6 py-3.5 font-semibold">Action</th>
                  <th className="px-6 py-3.5 font-semibold">Entity Mutated</th>
                  <th className="px-6 py-3.5 font-semibold">Record ID</th>
                  <th className="px-6 py-3.5 font-semibold text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                      {new Date(log.performedAt).toLocaleString()}
                    </td>

                    <td className="px-6 py-3.5 font-sans font-medium text-white">
                      {log.user?.fullName || 'System Trigger'}
                    </td>

                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-slate-300 font-sans">
                      <span className="font-semibold text-white">{log.tableName}</span>
                    </td>

                    <td className="px-6 py-3.5 text-slate-500 text-[11px] font-mono">
                      {log.recordId}
                    </td>

                    <td className="px-6 py-3.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-[11px] font-semibold transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-white">
              Audit Event Payload: <span className="text-blue-400">{selectedLog.tableName}</span> [
              <span className="font-mono text-xs">{selectedLog.action}</span>]
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Recorded at {new Date(selectedLog.performedAt).toUTCString()}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 font-mono text-[11px]">
              {/* Old Values */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
                <span className="text-red-400 font-bold block mb-1">◀ Pre-Mutation Snapshot:</span>
                <pre className="text-slate-400 whitespace-pre-wrap">
                  {selectedLog.oldData
                    ? JSON.stringify(selectedLog.oldData, null, 2)
                    : '// NULL (Creation Event)'}
                </pre>
              </div>

              {/* New Values */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
                <span className="text-emerald-400 font-bold block mb-1">▶ Post-Mutation Snapshot:</span>
                <pre className="text-slate-300 whitespace-pre-wrap">
                  {selectedLog.newData
                    ? JSON.stringify(selectedLog.newData, null, 2)
                    : '// NULL (Deletion Event)'}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
