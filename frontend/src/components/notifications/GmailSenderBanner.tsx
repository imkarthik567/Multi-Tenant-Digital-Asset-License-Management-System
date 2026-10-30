// ==============================================================================
// AssetVault: Universal One-Time Organization Admin Email Setup Modal & Icon
// Course: BCSE307L Database Systems (Fall 2026-27)
// - 100% Universal 24/7 Google App Password (SMTP) Setup: Works across every
//   Gmail account that has 2-Step Verification enabled, with zero OAuth consent
//   screen restrictions and zero hardcoded personal email addresses.
// - Includes an always-visible 3-step setup & troubleshooting guide with direct
//   links to Google 2-Step Verification and Google App Passwords.
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Send,
  ShieldCheck,
  ExternalLink,
  X,
  Loader2,
  LogOut,
  CheckCircle2,
  Info,
  KeyRound,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export interface GmailSenderBannerProps {
  compact?: boolean;
  variant?: 'auto-prompt' | 'header-button';
}

const OPEN_MODAL_EVENT = 'assetvault:open-gmail-modal';

export function openGmailConfigModal(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_MODAL_EVENT));
  }
}

export const GmailSenderBanner: React.FC<GmailSenderBannerProps> = ({
  variant = 'auto-prompt',
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = (toastContext as any).toast || toastContext;

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFirstTimePrompt, setIsFirstTimePrompt] = useState(false);
  const [customSenderEmail, setCustomSenderEmail] = useState(user?.email || '');
  const [smtpEmail, setSmtpEmail] = useState(user?.email || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  // Sync default form fields when logged-in user changes
  useEffect(() => {
    if (user?.email) {
      setCustomSenderEmail((prev) => prev || user.email);
      setSmtpEmail((prev) => prev || user.email);
    }
  }, [user?.email]);

  // Determine if the user is an Organization Admin or Super Admin
  const rawRole =
    typeof user?.role === 'string'
      ? user.role
      : (user?.role as any)?.name || 'MEMBER';
  const isAdmin =
    rawRole === 'TENANT_ADMIN' ||
    rawRole === 'SUPER_ADMIN' ||
    Boolean(user?.isSuperAdmin);

  const tenantScopeKey = user?.tenantId || user?.id || 'default-org';
  const storagePromptKey = `assetvault_gmail_setup_prompted_${tenantScopeKey}`;

  // Query Backend Gmail Delivery Status for current tenant & admin
  const { data: statusResponse } = useQuery({
    queryKey: ['gmail-status', user?.tenantId, user?.email],
    queryFn: async () => {
      try {
        const res = await api.get('/notifications/gmail-status');
        return res?.data || res;
      } catch {
        return {
          connected: false,
          realRelayActive: false,
          relayAccount: user?.email || null,
          mode: 'SANDBOX',
          senderEmail: user?.email || null,
          oauthConnected: false,
          smtpConfigured: false,
          pendingSandboxCount: 0,
        };
      }
    },
    staleTime: 5000,
    enabled: Boolean(user && isAdmin),
  });

  const status = statusResponse || {
    connected: false,
    realRelayActive: false,
    relayAccount: user?.email || null,
    mode: 'SANDBOX',
    senderEmail: user?.email || null,
    oauthConnected: false,
    smtpConfigured: false,
    pendingSandboxCount: 0,
  };

  const realRelayActive = Boolean(
    status.realRelayActive || status.smtpConfigured || status.oauthConnected
  );

  const activeSender =
    status.senderEmail || user?.email || 'admin@organization.io';

  // Listen for custom open event from the Team page header icon button
  useEffect(() => {
    if (variant !== 'auto-prompt') return;
    const handleOpen = () => {
      setCustomSenderEmail(activeSender);
      setSmtpEmail(user?.email || activeSender);
      setIsFirstTimePrompt(false);
      setIsConfigOpen(true);
    };
    window.addEventListener(OPEN_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_MODAL_EVENT, handleOpen);
  }, [variant, activeSender, user?.email]);

  // One-Time Automatic Pop-Up Trigger on Org Creation or First Admin Login
  useEffect(() => {
    if (variant !== 'auto-prompt' || !user || !isAdmin) return;
    try {
      const orgJustCreated =
        localStorage.getItem('assetvault_org_just_created') === 'true';
      const alreadyPrompted = localStorage.getItem(storagePromptKey) === 'true';

      if (orgJustCreated || !alreadyPrompted) {
        localStorage.setItem(storagePromptKey, 'true');
        localStorage.removeItem('assetvault_org_just_created');
        setCustomSenderEmail(user.email || activeSender);
        setSmtpEmail(user.email || activeSender);
        setIsFirstTimePrompt(true);
        setIsConfigOpen(true);
      }
    } catch {}
  }, [variant, user, isAdmin, storagePromptKey, activeSender]);

  const markPromptCompleted = () => {
    try {
      localStorage.setItem(storagePromptKey, 'true');
      localStorage.removeItem('assetvault_org_just_created');
    } catch {}
    setIsConfigOpen(false);
  };

  // 1. Mutation: Trigger Test Role-Change Email via 24/7 SMTP Relay
  const testRoleEmailMutation = useMutation({
    mutationFn: async (recipientEmail?: string) => {
      // If the admin typed their 16-char App Password in the input box and clicked Test directly, save it first!
      const cleanAppPassword = smtpPassword.replace(/\s+/g, '');
      if (cleanAppPassword.length >= 8) {
        const targetSmtpAccount =
          smtpEmail.trim().toLowerCase() ||
          customSenderEmail.trim().toLowerCase() ||
          user?.email ||
          activeSender;
        await api.post('/notifications/gmail-smtp', {
          email: targetSmtpAccount,
          appPassword: cleanAppPassword,
        });
        await api.post('/notifications/gmail-connect', {
          senderEmail:
            customSenderEmail.trim().toLowerCase() || targetSmtpAccount,
          senderName: user?.fullName,
          flushPending: true,
        });
        setSmtpPassword('');
      } else if (!realRelayActive) {
        passwordInputRef.current?.focus();
        throw new Error(
          'Please paste your 16-character Google App Password below and click Save Configuration first.'
        );
      }

      const emailToSend = recipientEmail || user?.email || activeSender;
      const res = await api.post('/notifications/test-role-change', {
        email: emailToSend,
        fullName: user?.fullName || 'Organization Admin',
        previousRole: 'ASSET_MANAGER',
        newRole: 'MEMBER',
        reason:
          'Automated 24/7 SMTP mail system verification (ASSET_MANAGER → MEMBER)',
      });
      return res?.data || res;
    },
    onSuccess: (data: any) => {
      const recipientsList: string[] = Array.isArray(data?.recipients)
        ? data.recipients
        : [data?.recipientEmail || user?.email || activeSender];
      if (data?.realGmailSent) {
        toast.success(
          `Real email delivered via 24/7 SMTP from ${activeSender} to: ${recipientsList.join(', ')}`
        );
      } else {
        toast.warning(
          `Logged test email for ${recipientsList.join(', ')}. Make sure 2-Step Verification is enabled and save a valid 16-character App Password to deliver to real inboxes.`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to dispatch test role-change email');
    },
  });

  // 2. Mutation: Save 24/7 Google App Password (SMTP) & Admin Sender Email
  const saveSenderOrSmtpMutation = useMutation({
    mutationFn: async (emailToBind: string) => {
      const cleanSender = (emailToBind || smtpEmail || user?.email || '')
        .trim()
        .toLowerCase();
      if (!cleanSender || !cleanSender.includes('@')) {
        throw new Error('Please enter a valid Gmail address');
      }

      const cleanAppPassword = smtpPassword.replace(/\s+/g, '');
      if (cleanAppPassword.length > 0 && cleanAppPassword.length < 16) {
        throw new Error(
          'Google App Passwords must be 16 characters long (spaces are ignored).'
        );
      }

      if (cleanAppPassword.length >= 16) {
        const targetSmtpAccount =
          smtpEmail.trim().toLowerCase() || cleanSender;
        await api.post('/notifications/gmail-smtp', {
          email: targetSmtpAccount,
          appPassword: cleanAppPassword,
        });
      }

      const res = await api.post('/notifications/gmail-connect', {
        senderEmail: cleanSender,
        senderName: user?.fullName,
        flushPending: true,
      });
      return {
        ...(res?.data || res),
        savedSmtp: cleanAppPassword.length >= 16,
      };
    },
    onSuccess: (data: any) => {
      const boundEmail =
        data?.senderEmail || customSenderEmail || user?.email;
      toast.success(
        data?.savedSmtp
          ? `24/7 Gmail App Password (SMTP) activated for ${boundEmail}!`
          : `Organization sender updated to ${boundEmail}`
      );
      setSmtpPassword('');
      if (realRelayActive || data?.savedSmtp) {
        markPromptCompleted();
      }
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      toast.error(
        err.message ||
          'Failed to verify App Password. Make sure 2-Step Verification is enabled on your Google account.'
      );
    },
  });

  // 3. Mutation: Reset Organization Sender Identity
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/notifications/gmail-disconnect', {});
      return res?.data || res;
    },
    onSuccess: () => {
      toast.info(
        `Reset organization sender identity to ${user?.email || 'default'}.`
      );
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset sender');
    },
  });

  if (!user || !isAdmin) {
    return null;
  }

  // ==========================================================================
  // Variant A: Compact Icon Button in Team Page Header
  // ==========================================================================
  if (variant === 'header-button') {
    return (
      <button
        type="button"
        onClick={openGmailConfigModal}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#0d1526] hover:bg-slate-800/90 border border-white/[0.08] hover:border-indigo-500/40 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        title={
          realRelayActive
            ? `24/7 Outbound Email Active (${activeSender}) — Click to test or configure`
            : `Configure 24/7 Outbound Email for ${activeSender}`
        }
        aria-label="Configure Admin Email Sender"
      >
        <Mail className="w-4 h-4 text-indigo-400" />
        <span
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#030712] ${
            realRelayActive ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          aria-hidden="true"
        />
      </button>
    );
  }

  // ==========================================================================
  // Variant B: 24/7 App Password (SMTP) Only Configuration Modal
  // ==========================================================================
  if (!isConfigOpen) {
    return null;
  }

  const effectiveSmtpTarget =
    smtpEmail.trim() || customSenderEmail.trim() || user?.email || '';
  const twoStepVerificationUrl = effectiveSmtpTarget
    ? `https://myaccount.google.com/signinoptions/two-step-verification?authuser=${encodeURIComponent(
        effectiveSmtpTarget
      )}`
    : 'https://myaccount.google.com/signinoptions/two-step-verification';
  const appPasswordsUrl = effectiveSmtpTarget
    ? `https://myaccount.google.com/apppasswords?authuser=${encodeURIComponent(
        effectiveSmtpTarget
      )}`
    : 'https://myaccount.google.com/apppasswords';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0b1120] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {isFirstTimePrompt
                    ? '24/7 Admin Email Setup (SMTP)'
                    : 'Admin Outbound Email Settings'}
                </h3>
                <span
                  className={`text-[11px] font-medium ${
                    realRelayActive ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {realRelayActive
                    ? '· 24/7 SMTP Active'
                    : '· Setup Needed'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {realRelayActive
                  ? `Sending 24/7 workspace emails as ${activeSender}`
                  : 'Works with any Gmail account that has 2-Step Verification enabled.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={markPromptCompleted}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Active Sender Summary Strip */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400">
                Active Organization Sender ({user.fullName})
              </p>
              <p className="text-xs font-mono text-white truncate">
                {activeSender}
              </p>
            </div>

            <button
              type="button"
              onClick={() => testRoleEmailMutation.mutate(activeSender)}
              disabled={testRoleEmailMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
              title="Send a real role-change email to yourself and all active workspace members"
            >
              {testRoleEmailMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {testRoleEmailMutation.isPending
                  ? 'Sending...'
                  : 'Test Role-Change Mail'}
              </span>
            </button>
          </div>

          {/* 24/7 Google App Password Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              24/7 Google App Password (SMTP)
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enter a 16-character Google App Password from your Google account for continuous background delivery of role changes, team invites, and license alerts.
            </p>
          </div>

          {/* Always-Visible 3-Step Setup & Troubleshooting Guide */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Simple Setup &amp; Troubleshooting Guide (If Not Working)
              </p>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                2-Step Verification Required
              </span>
            </div>

            <ol className="space-y-2 text-[11px] text-slate-300">
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-0.5">
                  <span className="font-medium text-white">
                    Enable 2-Step Verification on your Google Account:
                  </span>{' '}
                  <span className="text-slate-400">
                    If App Passwords says &ldquo;setting not available&rdquo; or fails to connect, make sure 2-Step Verification is turned <strong>ON</strong> first.
                  </span>{' '}
                  <a
                    href={twoStepVerificationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline"
                  >
                    Turn on 2-Step Verification <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </li>

              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <span className="font-medium text-white">
                    Create a 16-Character App Password:
                  </span>{' '}
                  <span className="text-slate-400">
                    Open Google App Passwords, enter any app name (e.g., <em>License Manager</em>), and copy the 16-letter code.
                  </span>{' '}
                  <a
                    href={appPasswordsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline"
                  >
                    Generate App Password <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </li>

              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <span className="font-medium text-white">
                    Paste &amp; Save Configuration:
                  </span>{' '}
                  <span className="text-slate-400">
                    Paste the 16-character code below (spaces are removed automatically), click <strong>Save Configuration</strong>, then click <strong>Test Role-Change Mail</strong>.
                  </span>
                </div>
              </li>
            </ol>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Admin Sender Email
                </label>
                <input
                  type="email"
                  value={customSenderEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomSenderEmail(val);
                    if (!smtpEmail || smtpEmail === customSenderEmail) {
                      setSmtpEmail(val);
                    }
                  }}
                  placeholder={user?.email || 'admin@gmail.com'}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gmail SMTP Account
                </label>
                <input
                  type="email"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  placeholder={user?.email || 'admin@gmail.com'}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  16-Character Google App Password
                </label>
                <a
                  href={appPasswordsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  Generate App Password <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                ref={passwordInputRef}
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                {realRelayActive ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300/90">
                      24/7 SMTP relay is active for {activeSender}. Enter a new App Password above only if you want to switch accounts.
                    </span>
                  </>
                ) : (
                  <>
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Note: Google requires 2-Step Verification to be turned on for your account to create an App Password.
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="py-1.5 px-2.5 text-xs font-medium text-slate-400 hover:text-rose-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Reset Sender</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markPromptCompleted}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    saveSenderOrSmtpMutation.mutate(customSenderEmail)
                  }
                  disabled={
                    saveSenderOrSmtpMutation.isPending || !customSenderEmail
                  }
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {saveSenderOrSmtpMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Save Configuration</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

