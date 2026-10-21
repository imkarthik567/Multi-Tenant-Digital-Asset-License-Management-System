// ==============================================================================
// AssetVault: Authentication & Authorization Context
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides user profile, RBAC permissions array, and in-memory session handling
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setAccessToken, getAccessToken, refreshAccessToken, setStoredRefreshToken } from '../services/api';
import { User, Tenant, RoleName } from '../types';
import { parseAuthProfile } from '../utils/auth.util';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Session: Check for existing in-memory token or perform silent cookie refresh
  const initAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      let token = getAccessToken();

      // If no token in memory, attempt silent refresh via httpOnly cookie
      if (!token) {
        try {
          token = await refreshAccessToken();
        } catch {
          // No active session in cookies or fallback storage
          setAccessToken(null);
          setStoredRefreshToken(null);
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
      }
    } catch (err) {
      console.error('[AuthContext] initAuth failed to restore session:', err);
      setAccessToken(null);
      setStoredRefreshToken(null);
      setUser(null);
      setTenant(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();

    const handleSessionExpired = () => {
      setAccessToken(null);
      setUser(null);
      setTenant(null);
      setPermissions([]);
      setIsLoading(false);
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session_expired', handleSessionExpired);
  }, [initAuth]);

  const login = async (email: string, password: string): Promise<User> => {
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
    const session = parseAuthProfile(res);
    setUser(session.user);
    setTenant(session.tenant);
    setPermissions(session.permissions);
    return session.user;
  };

  const register = async (payload: {
    tenantName: string;
    tenantSlug?: string;
    fullName: string;
    email: string;
    password: string;
    contactEmail?: string;
  }): Promise<User> => {
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
    const session = parseAuthProfile(res);
    setUser(session.user);
    setTenant(session.tenant);
    setPermissions(session.permissions);
    return session.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with clearing local state even if remote call fails
    } finally {
      setAccessToken(null);
      setStoredRefreshToken(null);
      setUser(null);
      setTenant(null);
      setPermissions([]);
    }
  };

  const refreshProfile = async () => {
    try {
      const meRes = await api.get<{ data: any }>('/auth/me');
      const session = parseAuthProfile(meRes);
      setUser(session.user);
      setTenant(session.tenant);
      setPermissions(session.permissions);
    } catch (err: any) {
      console.error('[AuthContext] refreshProfile failed to refresh profile:', err);
      throw err;
    }
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
