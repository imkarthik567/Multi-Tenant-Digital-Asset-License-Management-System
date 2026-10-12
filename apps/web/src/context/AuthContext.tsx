import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, ApiError } from '../services/api';
import { User, Tenant } from '../types';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  register: (payload: { tenantName: string; tenantSlug: string; fullName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    try {
      const storedToken = api.getToken();
      if (storedToken) {
        const res = await api.get<{ data: { user: User; tenant: Tenant } }>('/auth/me');
        setUser(res.data.user);
        setTenant(res.data.tenant);
      } else {
        // Try refresh token via cookie
        const res = await api.post<{ data: { user: User; tenant: Tenant; accessToken: string } }>('/auth/refresh');
        api.setToken(res.data.accessToken);
        setUser(res.data.user);
        setTenant(res.data.tenant);
      }
    } catch {
      api.setToken(null);
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    const handleUnauthorized = () => {
      api.setToken(null);
      setUser(null);
      setTenant(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string, tenantSlug?: string) => {
    const res = await api.post<{
      data: { user: User; tenant: Tenant; accessToken: string };
    }>('/auth/login', { email, password, tenantSlug });

    api.setToken(res.data.accessToken);
    setUser(res.data.user);
    setTenant(res.data.tenant);
  };

  const register = async (payload: {
    tenantName: string;
    tenantSlug: string;
    fullName: string;
    email: string;
    password: string;
  }) => {
    const res = await api.post<{
      data: { user: User; tenant: Tenant; accessToken: string };
    }>('/auth/register', payload);

    api.setToken(res.data.accessToken);
    setUser(res.data.user);
    setTenant(res.data.tenant);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout failure
    } finally {
      api.setToken(null);
      setUser(null);
      setTenant(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await api.get<{ data: { user: User; tenant: Tenant } }>('/auth/me');
      setUser(res.data.user);
      setTenant(res.data.tenant);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout();
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
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
