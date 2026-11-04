// ============================================================
// MessMate Centralized API Client
// ============================================================
// Handles HTTP communication with the FastAPI backend at /api/v1,
// attaches JWT bearer tokens from localStorage, manages session lifecycle,
// and gracefully formats server errors.

import { getCurrentTime, isMockTimeActive } from '../lib/clock';
import { storageGet, StorageKey } from '../lib/storage';
import { User } from '../types';

export const API_BASE_URL =
  import.meta.env.MODE === 'test'
    ? 'http://localhost:8000/api/v1'
    : import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:8000/api/v1';

export const TOKEN_STORAGE_KEY = 'messmate_jwt_token';

export interface ApiErrorResponse {
  detail?: string | Array<{ msg: string; loc?: string[] }>;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  data?: ApiErrorResponse;

  constructor(status: number, message: string, data?: ApiErrorResponse) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = {
  /**
   * Retrieve JWT access token from storage.
   */
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Store JWT access token in storage.
   */
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignored in restricted environments
    }
  },

  /**
   * Remove stored JWT token.
   */
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignored
    }
  },

  /**
   * Core request dispatcher with authentication and error unwrapping.
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const currentUser = storageGet<User | null>(StorageKey.CURRENT_USER, null);
    if (currentUser?.email && !headers.has('X-User-Email')) {
      headers.set('X-User-Email', currentUser.email);
    }

    if (!headers.has('X-Simulation-Time')) {
      headers.set('X-Simulation-Time', getCurrentTime().toISOString());
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Clear token on authentication expiry
        this.clearToken();
      }

      if (!response.ok) {
        let errData: ApiErrorResponse | undefined;
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          errData = await response.json();
          if (errData?.detail) {
            if (typeof errData.detail === 'string') {
              errorMessage = errData.detail;
            } else if (Array.isArray(errData.detail)) {
              errorMessage = errData.detail.map((e) => e.msg).join(', ');
            }
          }
        } catch {
          // Non-JSON error body
        }
        throw new ApiError(response.status, errorMessage, errData);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error(err instanceof Error ? err.message : 'Network request failed.');
    }
  },

  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },

  /**
   * Ping backend health endpoint to check real backend connectivity.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  },
};
