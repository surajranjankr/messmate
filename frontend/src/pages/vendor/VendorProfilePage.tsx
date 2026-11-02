// ============================================================
// Vendor Profile Page
// ============================================================

import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Utensils, Info } from 'lucide-react';

export const VendorProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Vendor Kitchen Profile
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          Kitchen team identity and catering facility parameters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <span>Catering Operator Details</span>
          </CardTitle>
          <CardDescription>
            Authorized catering vendor representative for IIIT Dharwad Mess 1
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-text-secondary block mb-1">Representative Name</span>
              <span className="font-semibold text-text-primary text-sm">{user?.displayName}</span>
            </div>
            <div>
              <span className="text-text-secondary block mb-1">Vendor Contact Email</span>
              <span className="font-mono text-text-primary">{user?.email}</span>
            </div>
            <div>
              <span className="text-text-secondary block mb-1">Contracted Unit</span>
              <span className="font-medium text-text-primary">Mess 1 Facility &bull; Kitchen Block A</span>
            </div>
            <div>
              <span className="text-text-secondary block mb-1">Operational Role</span>
              <Badge variant="warning">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-lavender/50 border border-border rounded-xl flex items-start gap-3 text-xs text-text-secondary">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          The catering staff interface is intentionally streamlined for quick operation during active meal prep hours. Complex administrative configurations are managed by the institute mess committee.
        </p>
      </div>
    </div>
  );
};
