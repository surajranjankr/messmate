// ============================================================
// Student Profile & Notification Preferences
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Bell, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const StudentProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [inAppReminders, setInAppReminders] = useState(true);
  const [whatsappReminders, setWhatsappReminders] = useState(false);
  const [dietaryPreference, setDietaryPreference] = useState('All / Standard');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Profile & Preferences
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          Manage your personal information and notification channels
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-success-light text-success border border-success/30 rounded-xl text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Preferences updated in browser storage!</span>
        </div>
      )}

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span>Student Identity</span>
          </CardTitle>
          <CardDescription>
            Institute student registry details (Phase 1 Demo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-text-secondary block mb-1">Full Name</span>
              <span className="font-semibold text-text-primary text-sm">{user?.displayName}</span>
            </div>
            <div>
              <span className="text-text-secondary block mb-1">Institute Email</span>
              <span className="font-mono text-text-primary">{user?.email}</span>
            </div>
            <div>
              <span className="text-text-secondary block mb-1">Hostel & Mess</span>
              <span className="font-medium text-text-primary">IIIT Dharwad Hostel &bull; Mess 1</span>
            </div>
            <div>
              <span className="text-text-secondary block mb-1">Account Role</span>
              <Badge variant="secondary">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span>Notification Preferences</span>
          </CardTitle>
          <CardDescription>
            Configure how you receive meal response reminders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* In-App Notifications */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">In-App Notification Centre</Label>
              <p className="text-xs text-text-secondary">
                Receive reminders when a new meal response window opens.
              </p>
            </div>
            <Switch
              checked={inAppReminders}
              onCheckedChange={setInAppReminders}
            />
          </div>

          <div className="h-px bg-border-light" />

          {/* WhatsApp Prototype Preference */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">WhatsApp Notifications</Label>
                <Badge variant="warning" className="text-[10px]">
                  Prototype Preference Only
                </Badge>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Receive interactive meal poll messages via WhatsApp.
              </p>
              <div className="mt-2 p-2.5 bg-lavender/60 border border-border-light rounded-lg text-[11px] text-text-secondary">
                <span className="font-semibold text-primary">Integration Status: </span>
                Not Connected — Prototype. WhatsApp Cloud API integration is planned for Phase 4.
              </div>
            </div>
            <Switch
              checked={whatsappReminders}
              onCheckedChange={setWhatsappReminders}
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} size="sm">
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
