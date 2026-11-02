// ============================================================
// Authentication Context & Provider
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginCredentials } from '@/types';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/apiClient';
import { initializeStorageIfEmpty } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Bootstrap storage with seed data if needed
    initializeStorageIfEmpty();

    // Restore existing session
    const current = authService.getCurrentUser();
    setUser(current);
    setIsLoading(false);

    // If session and token present, verify with FastAPI /auth/me
    if (current && apiClient.getToken()) {
      authService.refreshCurrentUser().then((fresh) => {
        if (fresh) setUser(fresh);
      });
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedIn = await authService.login(credentials);
      setUser(loggedIn);
      setIsLoading(false);
      return loggedIn;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
      setIsLoading(false);
      throw err;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        clearError,
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
