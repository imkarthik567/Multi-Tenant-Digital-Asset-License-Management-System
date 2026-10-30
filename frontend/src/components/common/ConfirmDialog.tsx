import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmText,
  cancelText,
  variant = 'danger',
  isLoading = false,
}) => {
  const finalConfirmLabel = confirmText || confirmLabel;
  const finalCancelLabel = cancelText || cancelLabel;

  const iconConfig = {
    danger: {
      icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
      bg: 'bg-rose-500/10 border border-rose-500/20',
      button: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      bg: 'bg-amber-500/10 border border-amber-500/20',
      button: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    info: {
      icon: <Info className="w-5 h-5 text-indigo-400" />,
      bg: 'bg-indigo-500/10 border border-indigo-500/20',
      button: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    },
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${iconConfig.button}`}
          >
            {isLoading ? 'Processing...' : finalConfirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3.5 py-1">
        <div className={`p-2.5 rounded-lg shrink-0 ${iconConfig.bg}`}>
          {iconConfig.icon}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
          {message}
        </p>
      </div>
    </Modal>
  );
};
