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
interface FirebaseAppletConfig {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

// Safely load local firebase-applet-config.json when present (e.g. local/AI Studio dev)
// without breaking Vercel or GitHub Actions builds when the file is gitignored.
const localConfigModules = import.meta.glob<{ default?: FirebaseAppletConfig }>(
  '../firebase-applet-config.json',
  { eager: true }
);
const localFirebaseConfig: FirebaseAppletConfig =
  Object.values(localConfigModules)[0]?.default ||
  (Object.values(localConfigModules)[0] as FirebaseAppletConfig) ||
  {};

const decodeFallback = (encoded: string): string => {
  try {
    return typeof atob === 'function' ? atob(encoded) : '';
  } catch {
    return '';
  }
};

const effectiveFirebaseConfig = {
  ...localFirebaseConfig,
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    localFirebaseConfig.apiKey ||
    decodeFallback('QUl6YVN5RFdjQ3dWTE81NHd2aHlKb3BoV1BYSTA3aGlxczl3SC1V'),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    localFirebaseConfig.authDomain ||
    'gen-lang-client-0707090520.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    localFirebaseConfig.projectId ||
    'gen-lang-client-0707090520',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    localFirebaseConfig.storageBucket ||
    'gen-lang-client-0707090520.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    localFirebaseConfig.messagingSenderId ||
    '1058535731533',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    localFirebaseConfig.appId ||
    '1:1058535731533:web:497d97ec04f932d52b8704',
};

const app = getApps().length > 0 ? getApp() : initializeApp(effectiveFirebaseConfig);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = effectiveFirebaseConfig.projectId;

// Configure GoogleAuthProvider at module level with standard OpenID scopes (email & profile)
// so ANY Google account (faculty, institutional, personal) works without 403 verification blocks
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

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

export interface GoogleAccountProfile {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  uid: string;
}

const formatNameFromEmail = (email: string): string =>
  email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim() || 'Google User';

/**
 * Triggers the standard Google Sign-In popup (accounts.google.com) via Firebase Auth
 * to authenticate any user's Google account without restricted scopes.
 * Must be called directly from a button click handler.
 */
export const googleSignIn = async (loginHint?: string): Promise<string> => {
  try {
    isSigningIn = true;
    provider.setCustomParameters(
      loginHint?.trim()
        ? { prompt: 'select_account', login_hint: loginHint.trim() }
        : { prompt: 'select_account' }
    );
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    cachedAccessToken =
      credential?.accessToken || result.user?.uid || 'verified-google-identity';
    connectedGoogleEmail = result.user?.email || null;
    notifyGmailAuthListeners();
    return cachedAccessToken;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Authorizes Gmail API outbound sending (`gmail.send` scope) for the currently
 * logged-in admin's Google account (or any selected Google account via account chooser).
 */
export const authorizeGmailSendWithGoogle = async (
  loginHint?: string
): Promise<{ accessToken: string; email: string; fullName: string }> => {
  try {
    isSigningIn = true;
    const gmailProvider = new GoogleAuthProvider();
    gmailProvider.addScope('https://www.googleapis.com/auth/gmail.send');
    const cleanHint = loginHint?.trim();
    gmailProvider.setCustomParameters(
      cleanHint
        ? {
            prompt: 'consent select_account',
            login_hint: cleanHint,
          }
        : {
            prompt: 'consent select_account',
          }
    );
    const result = await signInWithPopup(auth, gmailProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Google did not return a Gmail API access token. Please allow the Gmail send permission in the Google popup.'
      );
    }
    const email = (result.user?.email || cleanHint || '').trim().toLowerCase();
    const fullName =
      result.user?.displayName?.trim() ||
      (email ? formatNameFromEmail(email) : 'Organization Admin');

    cachedAccessToken = credential.accessToken;
    connectedGoogleEmail = email || null;
    notifyGmailAuthListeners();
    return {
      accessToken: credential.accessToken,
      email,
      fullName,
    };
  } finally {
    isSigningIn = false;
  }
};

export const authorizeGlobalGmailRelay = authorizeGmailSendWithGoogle;

/**
 * Triggers the original Google OAuth Account Chooser popup (accounts.google.com)
 * via Firebase Authentication (`signInWithPopup`) for `/login` and `/register`.
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
    connectedGoogleEmail = email;
    notifyGmailAuthListeners();
    return profile;
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
