// ==============================================================================
// AssetVault: StatusBadge Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Semantic color-coded badges for assets, licenses, tenants, and allocations
// ==============================================================================

import React from 'react';

interface StatusBadgeProps {
  status: string | null | undefined;
  variant?: 'solid' | 'subtle' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  if (!status) return null;

  const normalized = status.toUpperCase().trim();

  // Status mapping to modern deep obsidian theme with emerald, violet, amber, rose accents
  const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    // Positive / Active states
    ACTIVE: {
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-300 font-semibold',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
    COMPLIANT: {
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-300 font-semibold',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
    // Informational / Trial
    TRIAL: {
      bg: 'bg-indigo-950/40',
      text: 'text-indigo-300 font-medium',
      border: 'border-indigo-500/30',
      dot: 'bg-indigo-400',
    },
    DRAFT: {
      bg: 'bg-slate-900/60',
      text: 'text-slate-400',
      border: 'border-slate-700/50',
      dot: 'bg-slate-500',
    },
    // Warning / Expiring
    WARNING: {
      bg: 'bg-amber-950/40',
      text: 'text-amber-300 font-medium',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
    },
    NOTICE: {
      bg: 'bg-cyan-950/40',
      text: 'text-cyan-300',
      border: 'border-cyan-500/30',
      dot: 'bg-cyan-400',
    },
    UNLICENSED: {
      bg: 'bg-amber-950/40',
      text: 'text-amber-300 font-medium',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
    },
    // Danger / Critical / Suspended / Expired
    EXPIRED: {
      bg: 'bg-rose-950/40',
      text: 'text-rose-300 font-medium',
      border: 'border-rose-500/30',
      dot: 'bg-rose-400',
    },
    CRITICAL: {
      bg: 'bg-rose-950/50',
      text: 'text-rose-200 font-semibold',
      border: 'border-rose-500/40',
      dot: 'bg-rose-400',
    },
    SUSPENDED: {
      bg: 'bg-rose-950/30',
      text: 'text-rose-300',
      border: 'border-rose-800/40',
      dot: 'bg-rose-500',
    },
    ARCHIVED: {
      bg: 'bg-slate-900/60',
      text: 'text-slate-400',
      border: 'border-slate-800',
      dot: 'bg-slate-600',
    },
    RELEASED: {
      bg: 'bg-slate-900/60',
      text: 'text-slate-300',
      border: 'border-slate-700',
      dot: 'bg-slate-400',
    },
    REVOKED: {
      bg: 'bg-rose-950/40',
      text: 'text-rose-300',
      border: 'border-rose-800/40',
      dot: 'bg-rose-500',
    },
  };

  const currentTheme = colorMap[normalized] || {
    bg: 'bg-indigo-950/30',
    text: 'text-indigo-200',
    border: 'border-indigo-500/30',
    dot: 'bg-indigo-400',
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border transition-colors ${currentTheme.bg} ${currentTheme.text} ${currentTheme.border} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${currentTheme.dot}`} />
      <span>{normalized.replace('_', ' ')}</span>
    </span>
  );
};
