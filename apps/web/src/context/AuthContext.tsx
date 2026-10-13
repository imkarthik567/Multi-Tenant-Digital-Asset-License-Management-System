// ==============================================================================
// AssetVault: Authentication & Authorization Context
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides user profile, RBAC permissions array, and in-memory session handling
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setAccessToken, getAccessToken } from '../services/api';
import { User, Tenant, RoleName } from '../types';

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
          const refreshRes: any = await api.post('/auth/refresh');
          token = refreshRes?.data?.accessToken || refreshRes?.accessToken;
          setAccessToken(token);
        } catch {
          // No active session in cookies
          setAccessToken(null);
          setUser(null);
          setTenant(null);
          setPermissions([]);
          return;
        }
      }

      if (token) {
        // Fetch current authenticated user & permissions
        const meRes = await api.get<any>('/auth/me');
        const payload = meRes.data || meRes;
        const currentUser = payload.user;
        setUser(currentUser);
        setTenant(payload.tenant || currentUser.tenant || null);
        setPermissions(currentUser.permissions || []);
      }
    } catch {
      setAccessToken(null);
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
    const res = await api.post<any>('/auth/login', { email, password });
    const payload = res.data || res;
    const { accessToken, user: loggedInUser, tenant: userTenant } = payload;
    setAccessToken(accessToken);
    setUser(loggedInUser);
    setTenant(userTenant || loggedInUser.tenant || null);
    setPermissions(loggedInUser.permissions || []);
    return loggedInUser;
  };

  const register = async (payload: {
    tenantName: string;
    tenantSlug?: string;
    fullName: string;
    email: string;
    password: string;
  }): Promise<User> => {
    const res = await api.post<any>('/auth/register-tenant', payload);
    const result = res.data || res;
    const { accessToken, user: registeredUser, tenant: registeredTenant } = result;
    setAccessToken(accessToken);
    setUser(registeredUser);
    setTenant(registeredTenant);
    setPermissions(registeredUser.permissions || []);
    return registeredUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with clearing local state even if remote call fails
    } finally {
      setAccessToken(null);
      setUser(null);
      setTenant(null);
      setPermissions([]);
    }
  };

  const refreshProfile = async () => {
    try {
      const meRes = await api.get<any>('/auth/me');
      const payload = meRes.data || meRes;
      const currentUser = payload.user;
      setUser(currentUser);
      setTenant(payload.tenant || currentUser.tenant || null);
      setPermissions(currentUser.permissions || []);
    } catch {
      // Keep existing profile if re-fetch fails
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return permissions.includes(permission);
  };

  const hasRole = (roles: RoleName[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
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
