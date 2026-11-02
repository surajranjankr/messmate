import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, TOKEN_STORAGE_KEY, ApiError } from '../services/apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages JWT tokens in storage', () => {
    expect(apiClient.getToken()).toBeNull();
    apiClient.setToken('test-jwt-token-xyz');
    expect(apiClient.getToken()).toBe('test-jwt-token-xyz');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('test-jwt-token-xyz');

    apiClient.clearToken();
    expect(apiClient.getToken()).toBeNull();
  });

  it('automatically adds Authorization header when token exists', async () => {
    apiClient.setToken('mock-access-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy' }),
    });
    global.fetch = mockFetch;

    const res = await apiClient.get<{ status: string }>('/health');
    expect(res).toEqual({ status: 'healthy' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs).toBeDefined();
    const headers = callArgs![1]?.headers as Headers;
    expect(headers?.get('Authorization')).toBe('Bearer mock-access-token');
  });

  it('clears token on 401 Unauthorized', async () => {
    apiClient.setToken('expired-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Token expired' }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.get('/auth/me')).rejects.toThrow();
    expect(apiClient.getToken()).toBeNull();
  });

  it('formats server error detail messages cleanly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'The deadline for this meal has passed.' }),
    });
    global.fetch = mockFetch;

    try {
      await apiClient.post('/responses', { mealInstanceId: 'mi-1' });
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('The deadline for this meal has passed.');
      expect((err as ApiError).status).toBe(400);
    }
  });
});
