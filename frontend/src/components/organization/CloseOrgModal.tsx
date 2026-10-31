// ==============================================================================
// AssetVault: Close Organization Workspace Modal
// Course: BCSE307L Database Systems (Fall 2026-27)
// Safely closes workspace, emails members, purges records & frees admin email
// ==============================================================================

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Mail,
  ShieldAlert,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { api, setAccessToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface CloseOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  adminEmail: string;
}

export const CloseOrgModal: React.FC<CloseOrgModalProps> = ({
  isOpen,
  onClose,
  tenantName,
  adminEmail,
}) => {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [confirmInput, setConfirmInput] = useState('');

  const trimmedInput = confirmInput.trim().toLowerCase();
  const trimmedTarget = (tenantName || '').trim().toLowerCase();
  const isMatch = Boolean(trimmedInput && trimmedTarget && trimmedInput === trimmedTarget);

  const closeOrgMutation = useMutation({
    mutationFn: async () => {
      return api.post('/tenants/close-organization', {
        confirmationName: confirmInput.trim(),
      });
    },
    onSuccess: (res: any) => {
      const msg =
        res?.data?.message ||
        res?.message ||
        `Organization "${tenantName}" was successfully closed. Your email address has been released.`;
      toast({
        title: 'Organization Closed',
        message: msg,
        type: 'success',
      });

      // Clear tokens and cached session (preserve closure tombstone in assetvault_roster_sync_v3)
      try {
        setAccessToken(null);
        localStorage.removeItem('assetvault_auth_session_v1');
        sessionStorage.removeItem('assetvault_auth_session_v1');
        localStorage.removeItem('assetvault_session_cache');
        sessionStorage.removeItem('assetvault_session_cache');
        localStorage.removeItem('assetvault_roster_sync_v1');
      } catch {}

      onClose();

      // Redirect to login with clean slate
      setTimeout(() => {
        try {
          logout();
        } catch {}
        window.location.href = '/login';
      }, 700);
    },
    onError: (err: any) => {
      toast({
        title: 'Could Not Close Organization',
        message: err.message || 'An error occurred while closing the organization.',
        type: 'error',
      });
    },
  });

  const handleClose = () => {
    if (closeOrgMutation.isPending) return;
    setConfirmInput('');
    onClose();
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch || closeOrgMutation.isPending) return;
    closeOrgMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Close Organization Workspace"
      maxWidth="lg"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-rose-200">
              Irreversible Organization Deletion
            </h4>
            <p className="text-xs text-rose-300/80 leading-relaxed">
              This action will permanently delete <strong className="text-white">{tenantName}</strong>,
              all member accounts, and all software assets and licenses.
            </p>
          </div>
        </div>

        {/* Breakdown of effects */}
        <div className="space-y-2 text-xs">
          <p className="font-semibold text-slate-300">When you close this organization:</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span className="text-slate-300">
                All digital assets, software licenses, categories, and seat allocations are wiped permanently.
              </span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <Mail className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span className="text-slate-300">
                An automated offboarding email notification will be dispatched to all workspace team members.
              </span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-emerald-200">
                <strong className="text-white font-medium">Your email ({adminEmail}) will be freed</strong> so you
                can immediately be invited and join any other organization as a Member or Asset Manager, or register a new workspace.
              </span>
            </div>
          </div>
        </div>

        {/* Confirmation Input Field */}
        <div className="pt-2 border-t border-white/[0.07] space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            To confirm, please type <span className="font-semibold text-white select-all">"{tenantName}"</span> below:
          </label>
          <div className="relative">
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={tenantName}
              disabled={closeOrgMutation.isPending}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#0d1527] border border-white/[0.12] text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
              autoFocus
            />
            {isMatch && (
              <span className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Matched
              </span>
            )}
          </div>
          {!isMatch && confirmInput.length > 0 && (
            <p className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Name does not match "{tenantName}"
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/[0.07] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={closeOrgMutation.isPending}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isMatch || closeOrgMutation.isPending}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950 disabled:text-rose-400 disabled:border-rose-900/50 disabled:cursor-not-allowed transition-colors border border-rose-500/50 cursor-pointer shadow-lg shadow-rose-950/50"
          >
            {closeOrgMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Closing Workspace & Freeing Email...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Close Organization & Release Email
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
