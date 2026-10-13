// ==============================================================================
// AssetVault: Frontend HTTP Client with In-Memory Token & Silent Refresh
// Course: BCSE307L Database Systems (Fall 2026-27)
// Axios interceptor for JWT Bearer attachment and 401 token rotation retry
// ==============================================================================

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const rawBase = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = rawBase
  ? rawBase.endsWith('/api')
    ? rawBase
    : `${rawBase.replace(/\/+$/, '')}/api`
  : '/api';

// In-Memory Token Storage (Strictly NOT stored in localStorage)
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

// Create Axios Instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly cookies (for refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag and queue to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Silent 401 Refresh & Auto-Retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 occurs and is NOT the login or refresh endpoint itself
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue the request until the current refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            if (inMemoryAccessToken) {
              originalRequest.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent refresh via httpOnly cookie
        const res = await axios.post<ApiResponse<{ accessToken: string }>>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data.data.accessToken;
        setAccessToken(newAccessToken);
        processQueue(null);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error);
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent('auth:session_expired'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Helper to format Axios errors into standard ApiError
export const handleApiError = (err: unknown): never => {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status || 500;
    const errorData = err.response?.data?.error;
    const message = errorData?.message || err.message || 'An unexpected error occurred';
    const code = errorData?.code || 'NETWORK_ERROR';
    const details = errorData?.details;
    throw new ApiError(message, code, status, details);
  }
  if (err instanceof Error) {
    throw new ApiError(err.message);
  }
  throw new ApiError('An unknown error occurred');
};

// Typed Convenience API Wrapper
export const api = {
  async get<T = any>(url: string, configOrParams?: any): Promise<T> {
    try {
      const config = configOrParams?.params || configOrParams?.headers
        ? configOrParams
        : { params: configOrParams };
      const response = await apiClient.get<T>(url, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async post<T = any>(url: string, data?: unknown, configOrHeaders?: any): Promise<T> {
    try {
      const config = configOrHeaders?.headers
        ? configOrHeaders
        : configOrHeaders
        ? { headers: configOrHeaders }
        : undefined;
      const response = await apiClient.post<T>(url, data, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async put<T = any>(url: string, data?: unknown, config?: any): Promise<T> {
    try {
      const response = await apiClient.put<T>(url, data, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async patch<T = any>(url: string, data?: unknown, config?: any): Promise<T> {
    try {
      const response = await apiClient.patch<T>(url, data, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async delete<T = any>(url: string, configOrParams?: any): Promise<T> {
    try {
      const config = configOrParams?.params || configOrParams?.headers
        ? configOrParams
        : { params: configOrParams };
      const response = await apiClient.delete<T>(url, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },
};

