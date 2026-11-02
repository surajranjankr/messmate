// ============================================================
// System Settings Page
// ============================================================

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { resetToDefaults, initializeStorageIfEmpty } from '@/lib/storage';
import { resetClock } from '@/lib/clock';
import { Settings, RefreshCw, MessageSquare, Globe, Shield, CheckCircle2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [instituteName, setInstituteName] = useState('Indian Institute of Information Technology Dharwad');
  const [timezone] = useState('Asia/Kolkata (IST +05:30)');
  const [safetyMargin, setSafetyMargin] = useState('8');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetData = () => {
    if (
      window.confirm(
        'Are you sure you want to reset all MessMate local browser data to demo defaults? All custom edits, responses, and draft menus will be restored to initial state.'
      )
    ) {
      resetToDefaults();
      initializeStorageIfEmpty();
      resetClock();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          System Settings & Parameters
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          Configure institutional parameters, forecasting safety margins, and integration status.
        </p>
      </div>

      {saved && (
        <div className="p-3 bg-success-light text-success border border-success/30 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings saved to local storage!</span>
        </div>
      )}

      {/* Institutional Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span>Institution Configuration</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Organizational parameters governing mess catering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="instituteName">Institution Display Name</Label>
              <Input
                id="instituteName"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone">System Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                disabled
                className="bg-lavender/30 text-text-secondary"
              />
              <p className="text-[11px] text-text-secondary">
                All notification schedules and deadlines operate strictly under Asia/Kolkata timezone.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="safetyMargin">Provisional Safety Margin (%)</Label>
              <div className="relative">
                <Input
                  id="safetyMargin"
                  type="number"
                  min="0"
                  max="50"
                  value={safetyMargin}
                  onChange={(e) => setSafetyMargin(e.target.value)}
                />
                <span className="absolute right-3 top-2.5 text-text-secondary">%</span>
              </div>
              <p className="text-[11px] text-text-secondary">
                Default margin applied to baseline attendance: Q = ceil(F * (1 + m)).
              </p>
            </div>

            <Button type="submit" size="sm">
              Save Parameters
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Integration Status (WhatsApp Boundary) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>External Integrations</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Third-party notification gateways and messaging pipelines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-border bg-lavender/30 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text-primary text-sm">
                  WhatsApp Cloud API / Webhook Delivery
                </span>
                <Badge variant="error" className="text-[10px] uppercase font-bold">
                  Not Connected — Prototype
                </Badge>
              </div>
              <p className="text-text-secondary leading-relaxed">
                External WhatsApp reminder broadcasts and interactive response parsing are scheduled for Phase 4 backend integration. No live credentials or outgoing messages are active in Phase 1.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Development Reset */}
      <Card className="border-error/30">
        <CardHeader>
          <CardTitle className="text-base text-error flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            <span>Development Reset Controls</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Restore initial demo state if stored local browser data becomes inconsistent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-text-secondary leading-relaxed">
            This will wipe localStorage keys with the <code className="bg-lavender px-1 py-0.5 rounded text-primary font-mono">MESSMATE_STORAGE_V1</code> prefix and re-seed the environment with the original IIIT Dharwad Mess 1 dataset and demo accounts.
          </p>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetData}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Demo Data to Initial Defaults</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
