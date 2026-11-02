import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="w-16 h-16 rounded-2xl bg-lavender flex items-center justify-center text-primary mb-4 shadow-sm">
        <UtensilsCrossed className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-text-primary tracking-tight">404</h1>
      <h2 className="text-xl font-bold text-text-primary mt-2">Page Not Found</h2>
      <p className="text-sm text-text-secondary max-w-sm mt-2 mb-6">
        The meal planning portal page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Return Home</span>
        </Button>
      </Link>
    </div>
  );
};
