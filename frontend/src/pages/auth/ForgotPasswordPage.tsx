// ============================================================
// Forgot Password Page (Simulated Prototype)
// ============================================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Info } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your institutional email address to receive reset instructions
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 bg-success-light text-success rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-text-primary">Reset Link Simulated</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                In this Phase 1 prototype, real email delivery is not configured.
                For demonstration, you can log in with any demo account using password: <code className="text-primary font-mono font-bold">demo123</code>.
              </p>
              <Link to="/login" className="inline-block mt-4">
                <Button variant="default" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Institute Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@iiitdwd.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="p-3 bg-lavender/60 rounded-lg flex items-start gap-2 text-xs text-text-secondary">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Password reset will connect to the IIIT Dharwad LDAP / OAuth directory in Phase 2.
                </span>
              </div>

              <Button type="submit" className="w-full">
                Send Reset Link
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
