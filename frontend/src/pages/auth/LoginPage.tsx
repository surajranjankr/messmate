// ============================================================
// MessMate Login Page
// ============================================================
// Modern, responsive login portal for IIIT Dharwad Mess Management.
// Features institutional food imagery hero section and secure authentication.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { UserRole } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UtensilsCrossed,
  Eye,
  EyeOff,
  AlertCircle,
  CalendarCheck,
  TrendingUp,
  Leaf,
} from 'lucide-react';

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
      const user = await login({ email: email.trim(), password });
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
      // Error handled by AuthContext
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* ============================================================ */}
      {/* Left Hero Panel (Visual Direction & Food Imagery)            */}
      {/* ============================================================ */}
      <div className="w-full md:w-1/2 relative bg-gradient-to-br from-[#3b0764] via-[#4c1d95] to-[#2e1065] text-white p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col justify-between overflow-hidden shadow-2xl">
        {/* Subtle Decorative Ambient Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header & Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <UtensilsCrossed className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">MessMate</h1>
              <p className="text-xs text-purple-200/90 font-medium">IIIT Dharwad Mess Management</p>
            </div>
          </div>

          <div className="mt-8 md:mt-12 max-w-lg space-y-4">
            <Badge
              variant="secondary"
              className="bg-white/15 hover:bg-white/20 text-white border border-white/20 py-1 px-3.5 backdrop-blur-sm text-xs font-medium tracking-wide shadow-sm"
            >
              Institutional Mess System
            </Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
              Institutional Mess Demand Forecasting & Planning
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-purple-100/90 leading-relaxed max-w-md">
              Empowering students to communicate meal intentions in advance and giving mess vendors data-backed preparation insights to avoid food shortages and reduce food waste.
            </p>
          </div>
        </div>

        {/* Center Food Imagery Showcase */}
        <div className="relative z-10 my-6 md:my-8 flex justify-center items-center">
          <div className="relative group max-w-xs sm:max-w-sm md:max-w-md">
            {/* Soft Warm Radial Glow behind Thali */}
            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-purple-600/30 rounded-full blur-2xl transform scale-90" />
            <img
              src="/images/food-hero.png"
              alt="Indian Mess Thali - Authentic balanced nutritious meal"
              className="relative z-10 w-full h-auto object-contain max-h-[260px] sm:max-h-[300px] md:max-h-[320px] drop-shadow-[0_20px_25px_rgba(0,0,0,0.45)] transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-10 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/15 text-purple-200">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Plan Ahead</p>
              <p className="text-[11px] text-purple-200/80">Share meal intentions</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/15 text-purple-200">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Prepare Better</p>
              <p className="text-[11px] text-purple-200/80">Data-backed demand</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/15 text-purple-200">
              <Leaf className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Reduce Waste</p>
              <p className="text-[11px] text-purple-200/80">A more sustainable mess</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Right Sign-In Panel                                          */}
      {/* ============================================================ */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-16 bg-slate-50/50">
        <div className="w-full max-w-md space-y-6">
          <Card className="border border-border/60 shadow-xl bg-card">
            <CardHeader className="space-y-1.5 pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Sign In
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Sign in with your institute account to access your portal
              </CardDescription>
            </CardHeader>

            <CardContent>
              {(error || localError) && (
                <div className="mb-4 flex items-center gap-2.5 p-3 text-xs bg-error-light text-error border border-error/20 rounded-lg shadow-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{localError || error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground">
                    Institute Email / User ID
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@iiitdwd.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="username"
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">
                      Password
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:text-primary-dark hover:underline transition-colors font-medium"
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
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-3 h-10 font-semibold shadow-sm hover:shadow transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-border/50 text-center">
                <p className="text-xs text-muted-foreground">
                  Official Mess Management System • IIIT Dharwad
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
