const API_BASE = '/api/v1';

export class ApiError extends Error {
  public code: string;
  public details?: unknown;
  public status: number;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('assetvault_access_token', token);
    } else {
      localStorage.removeItem('assetvault_access_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('assetvault_access_token');
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers = {}, ...customConfig } = options;

    let url = `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const token = this.getToken();
    const reqHeaders = new Headers(headers);
    if (!reqHeaders.has('Content-Type') && !(customConfig.body instanceof FormData)) {
      reqHeaders.set('Content-Type', 'application/json');
    }
    if (token && !reqHeaders.has('Authorization')) {
      reqHeaders.set('Authorization', `Bearer ${token}`);
    }

    const config: RequestInit = {
      ...customConfig,
      headers: reqHeaders,
      credentials: 'include', // Include httpOnly cookies for refresh token
    };

    const response = await fetch(url, config);

    // Parse JSON response body
    let body: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    if (!response.ok) {
      const errorCode = body?.error?.code || 'HTTP_ERROR';
      const errorMessage = body?.error?.message || response.statusText || 'Request failed';
      const details = body?.error?.details;

      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        // Trigger potential refresh or redirect
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }

      throw new ApiError(errorMessage, errorCode, response.status, details);
    }

    return body;
  }

  get<T>(endpoint: string, optionsOrParams?: RequestOptions | RequestOptions['params']) {
    if (optionsOrParams && 'params' in optionsOrParams) {
      return this.request<T>(endpoint, { method: 'GET', ...optionsOrParams });
    }
    return this.request<T>(endpoint, { method: 'GET', params: optionsOrParams as RequestOptions['params'] });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  patch<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
