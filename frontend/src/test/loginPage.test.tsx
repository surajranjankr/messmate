import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { AuthProvider } from '@/features/auth/AuthContext';

describe('LoginPage Component', () => {
  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders institutional branding, headline, and hero food image', () => {
    renderLogin();

    // Institutional branding
    expect(screen.getByText('MessMate')).toBeTruthy();
    expect(screen.getByText('IIIT Dharwad Mess Management')).toBeTruthy();
    expect(screen.getByText('Institutional Mess System')).toBeTruthy();
    expect(screen.getByText('Institutional Mess Demand Forecasting & Planning')).toBeTruthy();

    // Food hero image
    const heroImg = screen.getByRole('img', { name: /indian mess thali/i });
    expect(heroImg).toBeTruthy();
    expect(heroImg.getAttribute('src')).toBe('/images/food-hero.png');

    // Value proposition badges
    expect(screen.getByText('Plan Ahead')).toBeTruthy();
    expect(screen.getByText('Prepare Better')).toBeTruthy();
    expect(screen.getByText('Reduce Waste')).toBeTruthy();
  });

  it('renders standard secure sign-in form elements', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeTruthy();
    expect(screen.getByLabelText(/institute email \/ user id/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /toggle password visibility/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /forgot password\?/i })).toBeTruthy();
  });

  it('strictly ensures Quick Demo Accounts and visible demo passwords are NOT rendered', () => {
    renderLogin();

    // Must NOT have quick demo headers or buttons
    expect(screen.queryByText(/quick demo accounts/i)).toBeNull();
    expect(screen.queryByText(/arjun sharma \(student\)/i)).toBeNull();
    expect(screen.queryByText(/mess vendor \(kitchen manager\)/i)).toBeNull();
    expect(screen.queryByText(/admin \(mess committee\)/i)).toBeNull();
    expect(screen.queryByText(/all demo accounts use password/i)).toBeNull();
    expect(screen.queryByText('demo123')).toBeNull();
  });
});
