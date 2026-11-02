// ============================================================
// Login Page (Phase 1 Prototype)
// ============================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { UserRole } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Please enter your institute email or ID.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    try {
      const user = await login({ email, password });
      // Role-based redirect
      if (user.role === UserRole.STUDENT) {
        navigate('/student');
      } else if (user.role === UserRole.VENDOR) {
        navigate('/vendor');
      } else if (user.role === UserRole.ADMIN) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch {
      // Handled by auth context
    }
  };

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setLocalError(null);
    clearError();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Branding Panel */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white p-8 md:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <UtensilsCrossed className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">MessMate</h1>
              <p className="text-xs text-lavender/80 font-medium">IIIT Dharwad Mess Management</p>
            </div>
          </div>

          <div className="mt-12 md:mt-20 max-w-md space-y-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-none py-1 px-3">
              Frugal Innovation Prototype
            </Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Institutional Mess Demand Forecasting & Planning
            </h2>
            <p className="text-sm md:text-base text-lavender/90 leading-relaxed">
              Empowering students to communicate meal intentions in advance and giving mess vendors data-backed preparation insights to avoid food shortages and reduce food waste.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 text-xs text-lavender/70 space-y-1">
          <p>Phase 1: Complete React frontend with local browser persistence.</p>
          <p>Uses official IIIT Dharwad Mess 1 Menu dataset.</p>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <Card className="border-border shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign In</CardTitle>
              <CardDescription>
                Sign in with your institute account to access your portal
              </CardDescription>
            </CardHeader>

            <CardContent>
              {(error || localError) && (
                <div className="mb-4 flex items-center gap-2 p-3 text-xs bg-error-light text-error border border-error/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{localError || error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Institute Email / User ID</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@iiitdwd.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-text-secondary hover:text-text-primary"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              {/* Demo Credentials Quick-Fill Selector */}
              <div className="mt-6 pt-5 border-t border-border-light">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Quick Demo Accounts (1-Click Fill)</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('arjun@iiitdwd.ac.in')}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-lavender/50 text-left transition-colors cursor-pointer text-xs"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">Arjun Sharma (Student)</div>
                      <div className="text-text-secondary text-[11px]">arjun@iiitdwd.ac.in</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Student</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillDemoAccount('vendor@iiitdwd.ac.in')}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-lavender/50 text-left transition-colors cursor-pointer text-xs"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">Mess Vendor (Kitchen Manager)</div>
                      <div className="text-text-secondary text-[11px]">vendor@iiitdwd.ac.in</div>
                    </div>
                    <Badge variant="warning" className="text-[10px]">Vendor</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillDemoAccount('admin@iiitdwd.ac.in')}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-lavender/50 text-left transition-colors cursor-pointer text-xs"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">Admin (Mess Committee)</div>
                      <div className="text-text-secondary text-[11px]">admin@iiitdwd.ac.in</div>
                    </div>
                    <Badge variant="default" className="text-[10px]">Admin</Badge>
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-text-secondary text-center">
                  All demo accounts use password: <code className="bg-lavender px-1.5 py-0.5 rounded text-primary font-mono">demo123</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
