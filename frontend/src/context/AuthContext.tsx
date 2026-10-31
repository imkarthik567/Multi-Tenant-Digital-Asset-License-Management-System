// ==============================================================================
// AssetVault: Authentication & Authorization Context
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides user profile, RBAC permissions array, and in-memory session handling
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  api,
  setAccessToken,
  getAccessToken,
  refreshAccessToken,
  setStoredRefreshToken,
  getStoredRefreshToken,
  getStoredSession,
  setStoredSession,
} from '../services/api';
import { User, Tenant, RoleName } from '../types';
import { parseAuthProfile } from '../utils/auth.util';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (payload: {
    email: string;
    fullName?: string;
    avatarUrl?: string | null;
    tenantName?: string;
    slug?: string;
    contactEmail?: string;
  }) => Promise<{
    requiresOnboarding: boolean;
    user?: User;
    profile?: {
      email: string;
      fullName: string;
      avatarUrl: string | null;
    };
  }>;
  register: (payload: {
    tenantName: string;
    tenantSlug?: string;
    fullName: string;
    email: string;
    password: string;
    contactEmail?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearAiChatSessionStorage = () => {
  try {
    const cleanStorage = (storage: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (
          key &&
          (key.startsWith('assetvault_gemini_chat_history') ||
            key.startsWith('assetvault_ai_chat_history'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    };
    cleanStorage(sessionStorage);
    cleanStorage(localStorage);
  } catch {}
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const initialSession = (getAccessToken() || getStoredRefreshToken()) ? getStoredSession() : null;

  const [user, setUser] = useState<User | null>(() => initialSession?.user ?? null);
  const [tenant, setTenant] = useState<Tenant | null>(() => initialSession?.tenant ?? null);
  const [permissions, setPermissions] = useState<string[]>(() => initialSession?.permissions ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialSession?.user);

  // Initialize Session: Restore persisted token or perform silent refresh
  const initAuth = useCallback(async () => {
    const cached = getStoredSession();
    if (!cached?.user) {
      setIsLoading(true);
    }

    try {
      let token = getAccessToken();

      // If no access token, attempt silent refresh via refresh token
      if (!token) {
        try {
          token = await refreshAccessToken();
        } catch {
          setAccessToken(null);
          setStoredRefreshToken(null);
          setStoredSession(null);
          setUser(null);
          setTenant(null);
          setPermissions([]);
          return;
        }
      }

      if (token) {
        // Fetch current authenticated user & permissions
        const meRes = await api.get<{ data: any }>('/auth/me');
        const session = parseAuthProfile(meRes);
        setUser(session.user);
        setTenant(session.tenant);
        setPermissions(session.permissions);
        setStoredSession(session);
      }
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 401 || status === 403 || !getAccessToken()) {
        setAccessToken(null);
        setStoredRefreshToken(null);
        setStoredSession(null);
        setUser(null);
        setTenant(null);
        setPermissions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();

    const handleSessionExpired = () => {
      setAccessToken(null);
      setStoredRefreshToken(null);
      setStoredSession(null);
      clearAiChatSessionStorage();
      queryClient.clear();
      setUser(null);
      setTenant(null);
      setPermissions([]);
      setIsLoading(false);
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session_expired', handleSessionExpired);
  }, [initAuth, queryClient]);

  const login = async (email: string, password: string): Promise<User> => {
    setAccessToken(null);
    setStoredRefreshToken(null);
    setStoredSession(null);

    const res = await api.post<{
      data: {
        user: User;
        accessToken: string;
        tenant?: Tenant | null;
      };
    }>('/auth/login', { email, password });

    const { accessToken } = res.data;
    setAccessToken(accessToken);
    if ((res.data as any).refreshToken) {
      setStoredRefreshToken((res.data as any).refreshToken);
    }
    clearAiChatSessionStorage();
    queryClient.clear();
    const session = parseAuthProfile(res);
    setStoredSession(session);
    setUser(session.user);
    setTenant(session.tenant);
    setPermissions(session.permissions);
    return session.user;
  };

  const loginWithGoogle = async (payload: {
    email: string;
    fullName?: string;
    avatarUrl?: string | null;
    tenantName?: string;
    slug?: string;
    contactEmail?: string;
  }) => {
    const res = await api.post<{
      data: {
        requiresOnboarding?: boolean;
        profile?: {
          email: string;
          fullName: string;
          avatarUrl: string | null;
        };
        user?: User;
        accessToken?: string;
        refreshToken?: string;
        tenant?: Tenant | null;
      };
    }>('/auth/google-sso', payload);

    if (res.data.requiresOnboarding) {
      return {
        requiresOnboarding: true,
        profile: res.data.profile || {
          email: payload.email,
          fullName: payload.fullName || payload.email.split('@')[0],
          avatarUrl: payload.avatarUrl || null,
        },
      };
    }

    if (res.data.accessToken) {
      setAccessToken(res.data.accessToken);
    }
    if (res.data.refreshToken) {
      setStoredRefreshToken(res.data.refreshToken);
    }
    clearAiChatSessionStorage();
    queryClient.clear();
    const session = parseAuthProfile(res);
    if (payload.tenantName && payload.tenantName.trim().length >= 2) {
      try {
        localStorage.setItem('assetvault_org_just_created', 'true');
        if (session.user.tenantId) {
          localStorage.removeItem(`assetvault_gmail_setup_prompted_v2_${session.user.tenantId}`);
        }
      } catch {}
    }
    setStoredSession(session);
    setUser(session.user);
    setTenant(session.tenant);
    setPermissions(session.permissions);
    return {
      requiresOnboarding: false,
      user: session.user,
    };
  };

  const register = async (payload: {
    tenantName: string;
    tenantSlug?: string;
    fullName: string;
    email: string;
    password: string;
    contactEmail?: string;
  }): Promise<User> => {
    setAccessToken(null);
    setStoredRefreshToken(null);
    setStoredSession(null);

    const generatedSlug = (payload.tenantSlug || payload.tenantName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const res = await api.post<{
      data: {
        user: User;
        tenant: Tenant;
        accessToken: string;
      };
    }>('/auth/register-tenant', {
      tenantName: payload.tenantName.trim(),
      slug: generatedSlug.length >= 2 ? generatedSlug : `org-${Date.now()}`,
      contactEmail: (payload.contactEmail || payload.email).trim(),
      adminFullName: payload.fullName.trim(),
      adminEmail: payload.email.trim(),
      password: payload.password,
    });

    const { accessToken } = res.data;
    setAccessToken(accessToken);
    if ((res.data as any).refreshToken) {
      setStoredRefreshToken((res.data as any).refreshToken);
    }
    clearAiChatSessionStorage();
    queryClient.clear();
    const session = parseAuthProfile(res);
    try {
      localStorage.setItem('assetvault_org_just_created', 'true');
      if (session.user.tenantId) {
        localStorage.removeItem(`assetvault_gmail_setup_prompted_v2_${session.user.tenantId}`);
      }
    } catch {}
    setStoredSession(session);
    setUser(session.user);
    setTenant(session.tenant);
    setPermissions(session.permissions);
    return session.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken: getStoredRefreshToken() });
    } catch {
      // Proceed with clearing local state even if remote call fails
    } finally {
      setAccessToken(null);
      setStoredRefreshToken(null);
      setStoredSession(null);
      clearAiChatSessionStorage();
      queryClient.clear();
      try {
        sessionStorage.removeItem('assetvault_last_route');
        localStorage.removeItem('assetvault_last_route');
      } catch {}
      setUser(null);
      setTenant(null);
      setPermissions([]);
    }
  };

  const refreshProfile = async () => {
    const meRes = await api.get<{ data: any }>('/auth/me');
    const session = parseAuthProfile(meRes);
    setUser(session.user);
    setTenant(session.tenant);
    setPermissions(session.permissions);
    setStoredSession(session);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    const roleName = typeof user.role === 'object' && user.role !== null ? (user.role as any).name : user.role;
    if (roleName === 'SUPER_ADMIN') return true;
    return permissions.includes(permission);
  };

  const hasRole = (roles: RoleName[]): boolean => {
    if (!user) return false;
    const roleName = typeof user.role === 'object' && user.role !== null ? (user.role as any).name : user.role;
    return roles.includes(roleName as RoleName);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        permissions,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshProfile,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const usePermission = (permission: string): boolean => {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
};
