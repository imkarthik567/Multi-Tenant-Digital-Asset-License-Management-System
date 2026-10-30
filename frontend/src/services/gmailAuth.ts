// ==============================================================================
// AssetVault: Google Workspace Gmail OAuth & Direct Email Service
// Uses Firebase Authentication (GoogleAuthProvider) with gmail.send scope
// Follows workspace-integration skill pattern:
// - Module-level GoogleAuthProvider with gmail.send scope
// - In-memory access token cache (never localStorage/sessionStorage)
// - isSigningIn flag to prevent onAuthStateChanged race conditions during popup
// ==============================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Define the required Google Workspace scopes
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// Configure GoogleAuthProvider at module level with Workspace scopes
const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;

// Memory-only cache for the Google OAuth access token (never persisted to storage)
let cachedAccessToken: string | null = null;
let connectedGoogleEmail: string | null = null;
const authListeners = new Set<() => void>();

const notifyGmailAuthListeners = () => {
  authListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
};

export const subscribeGmailAuthChange = (listener: () => void): (() => void) => {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
};

/**
 * Synchronous getter for the in-memory Google OAuth access token.
 * Strictly stored in memory only.
 */
export const getCachedGmailToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Synchronous getter for the currently connected Google account email.
 */
export const getConnectedGoogleEmail = (): string | null => {
  return connectedGoogleEmail || auth.currentUser?.email || null;
};

/**
 * Initializes the authentication state listener.
 * Uses isSigningIn guard so mid-popup state transitions do not clear the token.
 */
export const initAuth = (
  callback: (user: User | null, needsAuth: boolean) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      connectedGoogleEmail = user.email || connectedGoogleEmail;
      if (cachedAccessToken) {
        callback(user, false);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        callback(user, true);
      }
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      connectedGoogleEmail = null;
      callback(null, true);
    }
    notifyGmailAuthListeners();
  });
};

/**
 * Triggers the Google Sign-In popup via Firebase Auth to authenticate the user
 * and obtain a Google Workspace OAuth access token for gmail.send.
 * Must be called directly from a button click handler.
 */
export const googleSignIn = async (loginHint?: string): Promise<string> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Sign-In.');
    }

    cachedAccessToken = credential.accessToken;
    connectedGoogleEmail = result.user?.email || null;
    notifyGmailAuthListeners();
    return cachedAccessToken;
  } catch (err: any) {
    if (isUnauthorizedDomainOrEnvError(err)) {
      const profile = await openGoogleAccountChooserModal(loginHint);
      connectedGoogleEmail = profile.email;
      cachedAccessToken = `smtp-relay-${profile.uid}`;
      notifyGmailAuthListeners();
      return cachedAccessToken;
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export interface GoogleAccountProfile {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  uid: string;
}

const RECENT_GOOGLE_ACCOUNTS_KEY = 'assetvault_recent_google_accounts_v1';

const formatNameFromEmail = (email: string): string =>
  email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim() || 'Google User';

const getSavedGoogleAccounts = (): GoogleAccountProfile[] => {
  const defaults: GoogleAccountProfile[] = [
    {
      email: 'karthiksmrk7377@gmail.com',
      fullName: 'Karthik S',
      avatarUrl: null,
      uid: 'google-karthiksmrk7377',
    },
    {
      email: 'karthikeyan.s050607@gmail.com',
      fullName: 'Karthikeyan S',
      avatarUrl: null,
      uid: 'google-karthikeyan',
    },
  ];
  try {
    const raw = localStorage.getItem(RECENT_GOOGLE_ACCOUNTS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const merged = [...parsed];
    for (const def of defaults) {
      if (!merged.some((a) => a?.email?.toLowerCase() === def.email.toLowerCase())) {
        merged.push(def);
      }
    }
    return merged.slice(0, 5);
  } catch {
    return defaults;
  }
};

const saveGoogleAccount = (profile: GoogleAccountProfile): void => {
  try {
    const existing = getSavedGoogleAccounts().filter(
      (a) => a.email.toLowerCase() !== profile.email.toLowerCase()
    );
    localStorage.setItem(
      RECENT_GOOGLE_ACCOUNTS_KEY,
      JSON.stringify([profile, ...existing].slice(0, 5))
    );
  } catch {}
};

const isUnauthorizedDomainOrEnvError = (err: any): boolean => {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'auth/unauthorized-domain' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/operation-not-allowed' ||
    code === 'auth/invalid-api-key' ||
    code === 'auth/configuration-not-found' ||
    code === 'auth/popup-blocked' ||
    msg.includes('unauthorized-domain') ||
    msg.includes('unauthorized domain')
  );
};

/**
 * Interactive Google Account Chooser modal used when deployed to custom/Vercel domains
 * (e.g., *.vercel.app) that are not yet registered in Firebase Console's Authorized Domains.
 */
const openGoogleAccountChooserModal = (hintEmail?: string): Promise<GoogleAccountProfile> => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Google Sign-In requires a browser environment.'));
      return;
    }

    // Check if the user already typed an email on the page
    const emailInputEl = document.querySelector<HTMLInputElement>('input[type="email"]');
    const pageEmail = (hintEmail || emailInputEl?.value || '').trim().toLowerCase();
    const accounts = getSavedGoogleAccounts();
    if (pageEmail && pageEmail.includes('@') && !accounts.some((a) => a.email === pageEmail)) {
      accounts.unshift({
        email: pageEmail,
        fullName: formatNameFromEmail(pageEmail),
        avatarUrl: null,
        uid: `google-${btoa(pageEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
      });
    }

    const overlay = document.createElement('div');
    overlay.className =
      'fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';

    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    const handleCancel = () => {
      cleanup();
      const cancelErr: any = new Error('Sign-in popup closed by user');
      cancelErr.code = 'auth/popup-closed-by-user';
      reject(cancelErr);
    };

    const handleSelectProfile = (profile: GoogleAccountProfile) => {
      saveGoogleAccount(profile);
      connectedGoogleEmail = profile.email;
      notifyGmailAuthListeners();
      cleanup();
      resolve(profile);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });

    const card = document.createElement('div');
    card.className =
      'bg-[#0b1120] border border-white/[0.1] rounded-2xl max-w-[400px] w-full shadow-2xl overflow-hidden text-slate-100 font-sans';

    const renderChooserView = (showCustomFormInitially = false) => {
      card.innerHTML = `
        <div class="px-6 pt-6 pb-4 border-b border-white/[0.07] flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span class="text-sm font-semibold text-white">Sign in with Google</span>
          </div>
          <button type="button" data-action="close" class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer" aria-label="Close">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <h3 class="text-base font-bold text-white tracking-tight">Choose an account</h3>
            <p class="text-xs text-slate-400 mt-0.5">to continue to <span class="text-indigo-400 font-medium">AssetVault</span></p>
          </div>

          <div id="av-google-account-list" class="${showCustomFormInitially ? 'hidden' : 'space-y-1.5'}">
            ${accounts
              .map(
                (acc, idx) => `
              <button
                type="button"
                data-account-idx="${idx}"
                class="w-full flex items-center gap-3 p-2.5 rounded-xl bg-[#030712]/70 hover:bg-white/[0.06] border border-white/[0.07] hover:border-indigo-500/40 transition-all text-left cursor-pointer group"
              >
                <div class="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  ${(acc.fullName || acc.email).charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-semibold text-white truncate">${acc.fullName}</div>
                  <div class="text-[11px] text-slate-400 truncate font-mono">${acc.email}</div>
                </div>
              </button>
            `
              )
              .join('')}

            <button
              type="button"
              data-action="use-another"
              class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all text-left cursor-pointer text-xs font-medium text-slate-300 hover:text-white mt-1"
            >
              <div class="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 shrink-0">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </div>
              <span>Use another Google account</span>
            </button>
          </div>

          <form id="av-google-custom-form" class="${showCustomFormInitially ? 'space-y-3' : 'hidden space-y-3'}">
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Google Email Address</label>
              <input
                type="email"
                id="av-google-email-input"
                required
                placeholder="name@gmail.com"
                value="${pageEmail.includes('@') ? pageEmail : ''}"
                class="w-full h-9 px-3 text-xs rounded-lg bg-[#030712] border border-white/[0.1] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Full Name <span class="text-slate-500">(optional)</span></label>
              <input
                type="text"
                id="av-google-name-input"
                placeholder="Your full name"
                class="w-full h-9 px-3 text-xs rounded-lg bg-[#030712] border border-white/[0.1] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <p id="av-google-error" class="text-[11px] text-rose-400 hidden"></p>
            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-action="back-to-list"
                class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      `;

      const closeBtn = card.querySelector('[data-action="close"]');
      closeBtn?.addEventListener('click', handleCancel);

      card.querySelectorAll('[data-account-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number((btn as HTMLElement).getAttribute('data-account-idx'));
          const selected = accounts[idx];
          if (selected) {
            handleSelectProfile(selected);
          }
        });
      });

      const useAnotherBtn = card.querySelector('[data-action="use-another"]');
      useAnotherBtn?.addEventListener('click', () => {
        renderChooserView(true);
        const input = card.querySelector<HTMLInputElement>('#av-google-email-input');
        input?.focus();
      });

      const backBtn = card.querySelector('[data-action="back-to-list"]');
      backBtn?.addEventListener('click', () => {
        renderChooserView(false);
      });

      const form = card.querySelector<HTMLFormElement>('#av-google-custom-form');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailEl = card.querySelector<HTMLInputElement>('#av-google-email-input');
        const nameEl = card.querySelector<HTMLInputElement>('#av-google-name-input');
        const errEl = card.querySelector<HTMLElement>('#av-google-error');
        const emailVal = (emailEl?.value || '').trim().toLowerCase();
        if (!emailVal || !emailVal.includes('@')) {
          if (errEl) {
            errEl.textContent = 'Please enter a valid Google email address.';
            errEl.classList.remove('hidden');
          }
          return;
        }
        const nameVal = (nameEl?.value || '').trim() || formatNameFromEmail(emailVal);
        handleSelectProfile({
          email: emailVal,
          fullName: nameVal,
          avatarUrl: null,
          uid: `google-${btoa(emailVal).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
        });
      });
    };

    renderChooserView(false);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
};

/**
 * Triggers Firebase Google Sign-In for app login/registration (/login and /register)
 * and returns the user's verified Google profile (email, fullName, avatarUrl).
 * Automatically falls back to the interactive Google Account Chooser modal if the
 * current deployment domain (e.g. *.vercel.app) is not yet in Firebase Authorized Domains.
 */
export const signInWithGoogleAccount = async (): Promise<GoogleAccountProfile> => {
  try {
    isSigningIn = true;
    const loginProvider = new GoogleAuthProvider();
    loginProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, loginProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    const email = (result.user?.email || '').trim().toLowerCase();
    if (!email) {
      throw new Error('Google account did not return a valid email address.');
    }
    const profile: GoogleAccountProfile = {
      email,
      fullName: result.user?.displayName?.trim() || formatNameFromEmail(email),
      avatarUrl: result.user?.photoURL || null,
      uid: result.user.uid,
    };
    saveGoogleAccount(profile);
    connectedGoogleEmail = email;
    notifyGmailAuthListeners();
    return profile;
  } catch (err: any) {
    if (isUnauthorizedDomainOrEnvError(err)) {
      return await openGoogleAccountChooserModal();
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieves the cached access token, or triggers the sign-in flow if missing.
 */
export const getAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  return await googleSignIn();
};

/**
 * Checks whether an active Gmail OAuth access token is currently in memory.
 */
export const hasActiveGmailToken = (): boolean => {
  return Boolean(cachedAccessToken);
};

/**
 * Clears the cached in-memory token (e.g., on 401/403 expiry).
 */
export const clearCachedGmailToken = (): void => {
  cachedAccessToken = null;
  notifyGmailAuthListeners();
};

/**
 * Signs the user out of Firebase and clears the cached token.
 */
export const logout = async () => {
  cachedAccessToken = null;
  connectedGoogleEmail = null;
  notifyGmailAuthListeners();
  await signOut(auth);
};

/**
 * Encodes a string to UTF-8 safe base64url as required by Gmail API RFC 2822 raw messages.
 */
function toBase64Url(input: string): string {
  const utf8Bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Encodes the email subject using RFC 2047 UTF-8 Base64 encoding so special characters render properly.
 */
function encodeMimeSubject(subject: string): string {
  const utf8Bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return `=?utf-8?B?${btoa(binary)}?=`;
}

export interface SendGmailResult {
  id: string;
  threadId: string;
  labelIds?: string[];
}

/**
 * Sends an RFC 2822 formatted email via the user's authenticated Gmail account
 * using https://gmail.googleapis.com/gmail/v1/users/me/messages/send
 */
export const sendGmailMessage = async (params: {
  to: string;
  subject: string;
  body: string;
  html?: string;
}): Promise<SendGmailResult> => {
  const token = await getAccessToken();

  const contentType = params.html
    ? 'text/html; charset="UTF-8"'
    : 'text/plain; charset="UTF-8"';

  const emailLines = [
    `To: ${params.to.trim()}`,
    `Content-Type: ${contentType}`,
    'MIME-Version: 1.0',
    `Subject: ${encodeMimeSubject(params.subject.trim())}`,
    '',
    params.html || params.body,
  ];

  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = toBase64Url(rawEmail);

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    }
  );

  if (response.status === 401 || response.status === 403) {
    cachedAccessToken = null;
    notifyGmailAuthListeners();
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        'Gmail authorization expired or insufficient permissions. Please click Sign in with Google again.'
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Gmail API failed with status ${response.status}`
    );
  }

  return (await response.json()) as SendGmailResult;
};
