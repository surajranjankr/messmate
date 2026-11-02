import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '@/services/authService';
import { resetToDefaults, initializeStorageIfEmpty } from '@/lib/storage';
import { UserRole } from '@/types';

describe('AuthService (Prototype)', () => {
  beforeEach(() => {
    resetToDefaults();
    initializeStorageIfEmpty();
  });

  it('authenticates a student with valid demo credentials', async () => {
    const user = await authService.login({
      email: 'arjun@iiitdwd.ac.in',
      password: 'demo123',
    });
    expect(user.displayName).toBe('Arjun Sharma');
    expect(user.role).toBe(UserRole.STUDENT);
    expect(authService.getCurrentUser()?.id).toBe(user.id);
  });

  it('authenticates a vendor with valid demo credentials', async () => {
    const user = await authService.login({
      email: 'vendor@iiitdwd.ac.in',
      password: 'demo123',
    });
    expect(user.role).toBe(UserRole.VENDOR);
  });

  it('authenticates an administrator with valid demo credentials', async () => {
    const user = await authService.login({
      email: 'admin@iiitdwd.ac.in',
      password: 'demo123',
    });
    expect(user.role).toBe(UserRole.ADMIN);
  });

  it('rejects invalid password', async () => {
    await expect(
      authService.login({
        email: 'arjun@iiitdwd.ac.in',
        password: 'wrongpassword',
      })
    ).rejects.toThrow(/invalid/i);
  });

  it('rejects unknown email', async () => {
    await expect(
      authService.login({
        email: 'unknown@iiitdwd.ac.in',
        password: 'demo123',
      })
    ).rejects.toThrow(/invalid/i);
  });

  it('clears session on logout', async () => {
    await authService.login({
      email: 'arjun@iiitdwd.ac.in',
      password: 'demo123',
    });
    expect(authService.getCurrentUser()).not.toBeNull();
    authService.logout();
    expect(authService.getCurrentUser()).toBeNull();
  });
});
