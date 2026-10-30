// ==============================================================================
// AssetVault: Universal One-Time Organization Admin Email Setup Modal & Icon
// Course: BCSE307L Database Systems (Fall 2026-27)
// - 100% Universal: Each logged-in Organization Admin signs in with their own
//   Google account (OAuth gmail.send or 24/7 App Password) with zero hardcoded
//   personal email addresses anywhere in the UI or logic.
// - Dispatches role-change, onboarding, and license update emails to both the
//   logged-in admin and all active members of the organization workspace.
// ==============================================================================

import React, { useState, useEffect } from 'react';
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
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  initAuth,
  subscribeGmailAuthChange,
  googleSignIn,
  authorizeGmailSendWithGoogle,
  getConnectedGoogleEmail,
  FIREBASE_PROJECT_ID,
} from '../../services/gmailAuth';

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
  const [activeTab, setActiveTab] = useState<'oauth' | 'smtp'>('oauth');
  const [customSenderEmail, setCustomSenderEmail] = useState(user?.email || '');
  const [smtpEmail, setSmtpEmail] = useState(user?.email || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [oauthConsentWarning, setOauthConsentWarning] = useState(false);

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

  // Sync Firebase / In-Memory OAuth listener
  useEffect(() => {
    if (variant !== 'auto-prompt') return;
    const unsubFirebase = initAuth(() => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    });
    const unsubLocal = subscribeGmailAuthChange(() => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    });
    return () => {
      unsubFirebase();
      unsubLocal();
    };
  }, [queryClient, variant]);

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
    status.realRelayActive || status.oauthConnected || status.smtpConfigured
  );

  const activeSender =
    status.senderEmail ||
    getConnectedGoogleEmail() ||
    user?.email ||
    'admin@organization.io';

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
        setActiveTab('oauth');
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

  // 1. Mutation: Authorize Logged-In Admin's Google Account (OAuth gmail.send)
  const authorizeAdminOAuthMutation = useMutation({
    mutationFn: async (loginHintEmail?: string) => {
      setOauthConsentWarning(false);
      const authResult = await authorizeGmailSendWithGoogle(loginHintEmail);
      const res = await api.post('/notifications/gmail-connect', {
        accessToken: authResult.accessToken,
        senderEmail: authResult.email || loginHintEmail || user?.email,
        senderName: authResult.fullName || user?.fullName,
        flushPending: true,
      });
      return {
        auth: authResult,
        connect: res?.data || res,
      };
    },
    onSuccess: (data: any) => {
      const boundEmail =
        data?.auth?.email || data?.connect?.senderEmail || user?.email;
      toast.success(
        `Google account authorized (${boundEmail}). Real outbound Gmail delivery is now active for this workspace!`
      );
      markPromptCompleted();
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      if (
        msg.includes('access_denied') ||
        msg.includes('403') ||
        code.includes('unauthorized')
      ) {
        setOauthConsentWarning(true);
      }
      toast.error(
        err.message ||
          'Could not authorize Gmail send scope. If your GCP OAuth screen is in Testing mode, publish it or use an App Password.'
      );
    },
  });

  // 2. Mutation: Trigger Test Role-Change Email to Admin & All Workspace Members
  const testRoleEmailMutation = useMutation({
    mutationFn: async (recipientEmail?: string) => {
      let currentToken: string | undefined;
      let senderOverride = activeSender;

      // If no outbound transport is active yet, prompt the logged-in admin's Google OAuth
      if (!realRelayActive) {
        try {
          const authResult = await authorizeGmailSendWithGoogle(
            user?.email || activeSender
          );
          currentToken = authResult.accessToken;
          senderOverride = authResult.email || senderOverride;
          await api.post('/notifications/gmail-connect', {
            accessToken: authResult.accessToken,
            senderEmail: senderOverride,
            senderName: authResult.fullName || user?.fullName,
            flushPending: true,
          });
        } catch (oauthErr: any) {
          const code = String(oauthErr?.code || '');
          if (
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/cancelled-popup-request'
          ) {
            throw oauthErr;
          }
          setOauthConsentWarning(true);
        }
      }

      const emailToSend = recipientEmail || user?.email || senderOverride;
      const res = await api.post('/notifications/test-role-change', {
        email: emailToSend,
        fullName: user?.fullName || 'Organization Admin',
        previousRole: 'ASSET_MANAGER',
        newRole: 'MEMBER',
        reason:
          'Automated mail system test verification (ASSET_MANAGER → MEMBER)',
        accessToken: currentToken,
      });
      return res?.data || res;
    },
    onSuccess: (data: any) => {
      const recipientsList: string[] = Array.isArray(data?.recipients)
        ? data.recipients
        : [data?.recipientEmail || user?.email || activeSender];
      if (data?.realGmailSent) {
        toast.success(
          `Real email delivered from ${activeSender} to: ${recipientsList.join(', ')}`
        );
      } else {
        toast.warning(
          `Logged test email for ${recipientsList.join(', ')}. Authorize your Google account or configure an App Password to deliver to real inboxes.`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      const code = String(err?.code || '');
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      toast.error(err.message || 'Failed to dispatch test role-change email');
    },
  });

  // 3. Mutation: Connect Google Account Identity (Standard Sign-In without restricted scopes)
  const connectGoogleIdentityMutation = useMutation({
    mutationFn: async () => {
      await googleSignIn(user?.email || activeSender);
      const connectedEmail =
        getConnectedGoogleEmail() || user?.email || activeSender;
      const res = await api.post('/notifications/gmail-connect', {
        senderEmail: connectedEmail,
        senderName: user?.fullName,
        flushPending: true,
      });
      return res?.data || res;
    },
    onSuccess: (data: any) => {
      const boundEmail =
        data?.senderEmail || getConnectedGoogleEmail() || user?.email;
      toast.success(`Organization sender identity set to ${boundEmail}`);
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (err: any) => {
      const code = String(err?.code || '');
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      toast.error(err.message || 'Google Sign-In could not be completed');
    },
  });

  // 4. Mutation: Save Custom Admin Sender or 24/7 App Password (SMTP)
  const saveSenderOrSmtpMutation = useMutation({
    mutationFn: async (emailToBind: string) => {
      const cleanSender = (emailToBind || user?.email || '')
        .trim()
        .toLowerCase();
      if (!cleanSender || !cleanSender.includes('@')) {
        throw new Error('Please enter a valid admin email address');
      }

      // If admin entered a 16-char Google App Password, verify and save SMTP transport for this organization
      if (smtpPassword.trim().length >= 8) {
        const targetSmtpAccount =
          smtpEmail.trim().toLowerCase() || cleanSender;
        await api.post('/notifications/gmail-smtp', {
          email: targetSmtpAccount,
          appPassword: smtpPassword.trim(),
        });
      }

      const res = await api.post('/notifications/gmail-connect', {
        senderEmail: cleanSender,
        senderName: user?.fullName,
        flushPending: true,
      });
      return res?.data || res;
    },
    onSuccess: (data: any) => {
      const boundEmail =
        data?.senderEmail || customSenderEmail || user?.email;
      toast.success(
        smtpPassword.trim().length >= 8
          ? `24/7 Gmail SMTP configured and organization sender set to ${boundEmail}`
          : `Organization sender set to ${boundEmail}`
      );
      setSmtpPassword('');
      if (realRelayActive || smtpPassword.trim().length >= 8) {
        markPromptCompleted();
      }
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save email configuration');
    },
  });

  // 5. Mutation: Reset Organization Sender Identity
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
            ? `Outbound Email Active (${activeSender}) — Click to test or configure`
            : `Configure Outbound Email for ${activeSender}`
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
  // Variant B: Universal One-Time Setup & On-Demand Configuration Modal
  // ==========================================================================
  if (!isConfigOpen) {
    return null;
  }

  const effectiveSmtpTarget =
    smtpEmail.trim() || customSenderEmail.trim() || user?.email || '';
  const appPasswordsUrl = effectiveSmtpTarget
    ? `https://myaccount.google.com/apppasswords?authuser=${encodeURIComponent(
        effectiveSmtpTarget
      )}`
    : 'https://myaccount.google.com/apppasswords';
  const gcpConsentUrl = FIREBASE_PROJECT_ID
    ? `https://console.cloud.google.com/apis/credentials/consent?project=${encodeURIComponent(
        FIREBASE_PROJECT_ID
      )}`
    : 'https://console.cloud.google.com/apis/credentials/consent';

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
                    ? 'One-Time Admin Email Setup'
                    : 'Admin Outbound Email Settings'}
                </h3>
                <span
                  className={`text-[11px] font-medium ${
                    realRelayActive ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {realRelayActive
                    ? '· Live Delivery Active'
                    : '· Setup Needed'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {realRelayActive
                  ? `Sending workspace notifications as ${activeSender}`
                  : 'Connect your admin Google account to send organization emails.'}
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
        <div className="p-5 space-y-4">
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

          {/* Delivery Method Selector Tabs */}
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('oauth')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'oauth'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Google Sign-In (OAuth)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('smtp')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'smtp'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24/7 App Password (SMTP)
            </button>
          </div>

          {activeTab === 'oauth' ? (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  Send from Your Signed-In Google Account
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Authorize with your Google account so role updates, member onboarding credentials, and license alerts are sent directly from your organization admin address to all workspace members.
                </p>
              </div>

              {/* Helpful Guidance if Google Cloud OAuth Consent Screen is in "Testing" Mode */}
              {oauthConsentWarning && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-100">
                        Why did Google show &ldquo;Error 403: access_denied&rdquo;?
                      </p>
                      <p className="text-[11px] text-amber-200/85 leading-relaxed">
                        Your Google Cloud OAuth Consent Screen is currently in <strong>Testing</strong> mode, which blocks non-owner Google accounts from granting the <span className="font-mono">gmail.send</span> permission. Click <strong>Publish App</strong> (set to <em>In production</em>) in Google Cloud Console so <strong>any</strong> Google account can authorize, or use the <strong>24/7 App Password (SMTP)</strong> tab.
                      </p>
                      <a
                        href={gcpConsentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-100 underline pt-0.5"
                      >
                        Open Google Cloud OAuth Consent Screen <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {/* Primary Action: Authorize Gmail API Send with Logged-In Admin Account */}
                <button
                  type="button"
                  onClick={() =>
                    authorizeAdminOAuthMutation.mutate(user?.email || undefined)
                  }
                  disabled={authorizeAdminOAuthMutation.isPending}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {authorizeAdminOAuthMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#ffffff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#e2e8f0"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#cbd5e1"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#f8fafc"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>
                    Authorize Gmail Delivery ({user?.email || 'My Google Account'})
                  </span>
                </button>

                {/* Secondary Action: Choose Any Google Account for Gmail Delivery */}
                <button
                  type="button"
                  onClick={() => authorizeAdminOAuthMutation.mutate(undefined)}
                  disabled={authorizeAdminOAuthMutation.isPending}
                  className="w-full py-2.5 px-4 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Choose Another Google Account</span>
                </button>

                {/* Quick Sender Identity Confirmation */}
                {user?.email && (
                  <button
                    type="button"
                    onClick={() => connectGoogleIdentityMutation.mutate()}
                    disabled={connectGoogleIdentityMutation.isPending}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {connectGoogleIdentityMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>
                      Verify Sender Identity Only (No Extra Permissions)
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="py-1.5 px-2.5 text-xs font-medium text-slate-400 hover:text-rose-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Reset Sender</span>
                  </button>

                  <button
                    type="button"
                    onClick={markPromptCompleted}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  24/7 Google App Password (SMTP)
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Enter a 16-character Google App Password from your Google account (requires 2-Step Verification enabled on your Google account) for continuous background delivery.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Admin Sender Email
                  </label>
                  <input
                    type="email"
                    value={customSenderEmail}
                    onChange={(e) => setCustomSenderEmail(e.target.value)}
                    placeholder={user?.email || 'admin@organization.com'}
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
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>
                    Note: Google requires 2-Step Verification to be turned on for your account to create an App Password.
                  </span>
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
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
          )}
        </div>
      </div>
    </div>
  );
};
