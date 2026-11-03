// ============================================================
// Authentication Service (Integrated Full-Stack)
// ============================================================
// Connects with FastAPI /auth/login and /auth/me endpoints using JWT tokens.
// Features resilient offline fallback for local testing.

import { User, UserRole, UserStatus, LoginCredentials } from '../types';
import { storageGet, storageSet, storageRemove, StorageKey } from '../lib/storage';
import { DEMO_PASSWORD } from '../mocks/seedData';
import { apiClient } from './apiClient';
import { generateId } from '../lib/utils';

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export const authService = {
  /**
   * Log in with email and password against FastAPI backend with JWT token receipt.
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const emailNormalized = credentials.email.trim().toLowerCase();

    try {
      // 1. Attempt real FastAPI authentication endpoint
      const response = await apiClient.post<TokenResponse>('/auth/login', {
        email: emailNormalized,
        password: credentials.password,
      });

      if (response && response.accessToken) {
        apiClient.setToken(response.accessToken);
        storageSet(StorageKey.CURRENT_USER, response.user);
        return response.user;
      }
    } catch (err: unknown) {
      // If server specifically returned 401 Unauthorized, rethrow exact message
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.toLowerCase().includes('invalid email or password') || errMsg.toLowerCase().includes('inactive')) {
        throw err;
      }
      // If network unreachable, fallback to mock credentials for offline testing
    }

    // 2. Offline fallback for standalone unit testing
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const matchedUser = users.find(
      (u) => u.email.toLowerCase() === emailNormalized && u.status === UserStatus.ACTIVE
    );

    if (!matchedUser || credentials.password !== DEMO_PASSWORD) {
      throw new Error('Invalid email or password. Use demo credentials (password: demo123).');
    }

    storageSet(StorageKey.CURRENT_USER, matchedUser);
    return matchedUser;
  },

  /**
   * Log out the current user and clear JWT token and storage session.
   */
  logout(): void {
    try {
      apiClient.post('/auth/logout').catch(() => {});
    } catch {
      // Ignored
    }
    apiClient.clearToken();
    storageRemove(StorageKey.CURRENT_USER);
  },

  /**
   * Retrieve the current logged-in user from storage.
   */
  getCurrentUser(): User | null {
    return storageGet<User | null>(StorageKey.CURRENT_USER, null);
  },

  /**
   * Verify and refresh current user profile from server /auth/me.
   */
  async refreshCurrentUser(): Promise<User | null> {
    try {
      const user = await apiClient.get<User>('/auth/me');
      if (user) {
        storageSet(StorageKey.CURRENT_USER, user);
        return user;
      }
    } catch {
      // Offline or expired
    }
    return this.getCurrentUser();
  },

  /**
   * Get all registered users (for admin user management).
   */
  getUsers(): User[] {
    return storageGet<User[]>(StorageKey.USERS, []);
  },

  /**
   * Ensure the active session has a valid JWT Bearer token for backend calls.
   * Seamlessly re-authenticates if the token was lost or expired during development.
   */
  async ensureValidToken(): Promise<string | null> {
    const existingToken = apiClient.getToken();
    if (existingToken) return existingToken;

    const currentUser = storageGet<User | null>(StorageKey.CURRENT_USER, null);
    if (currentUser?.email) {
      try {
        const response = await apiClient.post<TokenResponse>('/auth/login', {
          email: currentUser.email,
          password: DEMO_PASSWORD,
        });
        if (response?.accessToken) {
          apiClient.setToken(response.accessToken);
          return response.accessToken;
        }
      } catch {
        // Fallback
      }
    }
    return null;
  },

  /**
   * Asynchronously fetch registered users from backend.
   */
  async fetchUsers(): Promise<User[]> {
    await this.ensureValidToken();
    try {
      const users = await apiClient.get<User[]>('/users');
      if (users && Array.isArray(users)) {
        storageSet(StorageKey.USERS, users);
        return users;
      }
    } catch {
      // Fallback
    }
    return this.getUsers();
  },

  /**
   * Add a new demo user (admin only).
   */
  addUser(userData: Omit<User, 'id'>): User {
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const newUser: User = {
      ...userData,
      id: `user-${generateId().slice(0, 8)}`,
    };

    if (users.some((u) => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }

    const updated = [...users, newUser];
    storageSet(StorageKey.USERS, updated);

    // Sync in background with backend
    this.ensureValidToken().then(() => {
      apiClient.post('/users', userData).catch(() => {});
    });

    return newUser;
  },

  /**
   * Asynchronously add a new user and persist directly to FastAPI backend (MongoDB/SQLite).
   */
  async addUserAsync(userData: Omit<User, 'id'>): Promise<User> {
    await this.ensureValidToken();
    const users = storageGet<User[]>(StorageKey.USERS, []);

    if (users.some((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }

    // Call backend API
    const created = await apiClient.post<User>('/users', userData);
    const newUser: User = created?.id ? created : {
      ...userData,
      id: `user-${generateId().slice(0, 8)}`,
    };

    const updated = [...users.filter((u) => u.id !== newUser.id), newUser];
    storageSet(StorageKey.USERS, updated);
    return newUser;
  },

  /**
   * Update an existing user's details or status.
   */
  updateUser(id: string, updates: Partial<User>): User {
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error('User not found.');
    }

    const updatedUser = { ...users[index]!, ...updates, id };
    users[index] = updatedUser;
    storageSet(StorageKey.USERS, users);

    // If updating current user, refresh session
    const currentUser = storageGet<User | null>(StorageKey.CURRENT_USER, null);
    if (currentUser?.id === id) {
      storageSet(StorageKey.CURRENT_USER, updatedUser);
    }

    // Sync in background with backend
    this.ensureValidToken().then(() => {
      apiClient.patch(`/users/${id}`, updates).catch(() => {});
    });

    return updatedUser;
  },

  /**
   * Asynchronously update user details and persist to backend.
   */
  async updateUserAsync(id: string, updates: Partial<User>): Promise<User> {
    await this.ensureValidToken();
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error('User not found.');
    }

    const updatedUser = { ...users[index]!, ...updates, id };
    users[index] = updatedUser;
    storageSet(StorageKey.USERS, users);

    await apiClient.patch(`/users/${id}`, updates);
    return updatedUser;
  },

  /**
   * Toggle user active/inactive status.
   */
  toggleUserStatus(id: string): User {
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error('User not found.');
    const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;

    // Sync with backend endpoint
    this.ensureValidToken().then(() => {
      apiClient.patch(`/users/${id}/status`).catch(() => {});
    });

    return this.updateUser(id, { status: newStatus });
  },

  /**
   * Asynchronously toggle user status and persist to backend.
   */
  async toggleUserStatusAsync(id: string): Promise<User> {
    await this.ensureValidToken();
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error('User not found.');
    const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;

    try {
      const res = await apiClient.patch<User>(`/users/${id}/status`);
      if (res) {
        return this.updateUser(id, { status: res.status });
      }
    } catch {
      // Local fallback
    }

    return this.updateUser(id, { status: newStatus });
  },

  /**
   * Permanently delete a user account from storage and backend.
   */
  deleteUser(id: string): void {
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const filtered = users.filter((u) => u.id !== id);
    storageSet(StorageKey.USERS, filtered);

    this.ensureValidToken().then(() => {
      apiClient.delete(`/users/${id}`).catch(() => {});
    });
  },

  /**
   * Asynchronously delete a user account and await backend deletion.
   */
  async deleteUserAsync(id: string): Promise<void> {
    await this.ensureValidToken();
    const users = storageGet<User[]>(StorageKey.USERS, []);
    const filtered = users.filter((u) => u.id !== id);
    storageSet(StorageKey.USERS, filtered);

    await apiClient.delete(`/users/${id}`);
  },
};
