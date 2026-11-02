// ============================================================
// Notification Schedule Management Page
// ============================================================
// Manages the 28 meal/weekday notification schedules, enforces time
// validity, and detects overlapping response windows with required acknowledgement.

import React, { useState, useEffect } from 'react';
import { scheduleService } from '@/services/scheduleService';
import {
  NotificationSchedule,
  DayOfWeek,
  MealType,
  ScheduleValidationResult,
  ScheduleOverlapWarning,
} from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDayOfWeek, formatMealType } from '@/lib/utils';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Edit,
  Save,
  Check,
  Info,
  Calendar,
} from 'lucide-react';

export const ScheduleManagementPage: React.FC = () => {
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DayOfWeek.MONDAY);
  const [validationResult, setValidationResult] = useState<ScheduleValidationResult | null>(null);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<NotificationSchedule | null>(null);
  const [notifyTime, setNotifyTime] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [mealOffset, setMealOffset] = useState<number>(0);
  const [enabled, setEnabled] = useState(true);

  // Overlap warning modal
  const [pendingOverlap, setPendingOverlap] = useState<ScheduleOverlapWarning | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const days = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
  ];

  const loadSchedules = () => {
    const list = scheduleService.getSchedules();
    setSchedules(list);
    const val = scheduleService.validateSchedules(list);
    setValidationResult(val);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenEdit = (sched: NotificationSchedule) => {
    setEditingSchedule(sched);
    setNotifyTime(sched.notifySendTime);
    setDeadlineTime(sched.responseDeadlineTime);
    setMealOffset(sched.mealDateOffset);
    setEnabled(sched.enabled);
    setIsEditDialogOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    // Tentative schedule update
    const updated = {
      ...editingSchedule,
      notifySendTime: notifyTime,
      responseDeadlineTime: deadlineTime,
      mealDateOffset: mealOffset,
      enabled,
      overlapAcknowledged: false, // Reset on time modification to re-validate
    };

    // Run validation on the proposed change
    const proposedList = schedules.map((s) => (s.id === updated.id ? updated : s));
    const result = scheduleService.validateSchedules(proposedList);

    // If there are fatal errors (e.g. deadline before send time), block saving
    const relevantError = result.errors.find((err) => err.scheduleId === updated.id);
    if (relevantError) {
      alert(`Validation error: ${relevantError.message}`);
      return;
    }

    // Check if there is an unacknowledged overlap created
    const relevantWarning = result.warnings.find(
      (w) => (w.schedule1Id === updated.id || w.schedule2Id === updated.id) && !w.acknowledged
    );

    if (relevantWarning) {
      // Prompt for explicit acknowledgment
      setPendingOverlap(relevantWarning);
      return;
    }

    // No blockers, save immediately
    scheduleService.updateSchedule(updated.id, updated);
    setIsEditDialogOpen(false);
    loadSchedules();
    showToast('Schedule saved successfully.');
  };

  const handleAcknowledgeOverlap = () => {
    if (!pendingOverlap || !editingSchedule) return;

    // Acknowledge overlap and save
    scheduleService.updateSchedule(editingSchedule.id, {
      notifySendTime: notifyTime,
      responseDeadlineTime: deadlineTime,
      mealDateOffset: mealOffset,
      enabled,
      overlapAcknowledged: true,
    });

    scheduleService.acknowledgeOverlap(
      pendingOverlap.schedule1Id,
      pendingOverlap.schedule2Id
    );

    setPendingOverlap(null);
    setIsEditDialogOpen(false);
    loadSchedules();
    showToast('Schedule saved with acknowledged window overlap.');
  };

  const daySchedules = schedules.filter((s) => s.dayOfWeek === selectedDay);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Notification & Deadline Schedules
            </h2>
            <Badge variant="outline" className="text-xs font-mono">
              28 Slots (Asia/Kolkata)
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">
            Configure reminder dispatch times and response deadlines for all 7 days and 4 meal slots.
          </p>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-success-light text-success border border-success/30 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Validation Warnings Alert Banner */}
      {validationResult && validationResult.warnings.length > 0 && (
        <div className="p-4 bg-warning-light/70 border border-warning/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-warning uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Response Window Overlaps Detected</span>
          </div>
          <ul className="text-xs text-text-secondary space-y-1">
            {validationResult.warnings.map((w, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-warning font-bold">•</span>
                <span>
                  {w.overlapDescription}{' '}
                  {w.acknowledged ? (
                    <Badge variant="muted" className="text-[10px] ml-1">Acknowledged</Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px] ml-1">Requires Review</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Day Selector */}
      <div className="flex overflow-x-auto gap-2 pb-1">
        {days.map((day) => (
          <Button
            key={day}
            variant={selectedDay === day ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedDay(day)}
            className="text-xs font-semibold shrink-0"
          >
            {formatDayOfWeek(day)}
          </Button>
        ))}
      </div>

      {/* Schedules Table for Selected Day */}
      <Card>
        <CardHeader className="pb-3 border-b border-border-light bg-lavender/20">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span>{formatDayOfWeek(selectedDay)} Meal Schedules</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Response deadlines serve as both the response and last-minute change deadline.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notification Send Time</TableHead>
                <TableHead>Response Deadline</TableHead>
                <TableHead>Timing Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daySchedules.map((sched) => (
                <TableRow key={sched.id}>
                  <TableCell className="font-bold text-xs text-text-primary">
                    {formatMealType(sched.mealType)}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={sched.enabled ? 'success' : 'muted'}
                      className="text-[10px]"
                    >
                      {sched.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs font-mono font-medium">
                    {sched.notifySendTime}
                    {sched.mealDateOffset === 1 && (
                      <span className="text-[11px] text-text-secondary font-normal ml-1">
                        (Day before)
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs font-mono font-medium text-primary">
                    {sched.responseDeadlineTime}
                    {sched.mealDateOffset === 1 && (
                      <span className="text-[11px] text-text-secondary font-normal ml-1">
                        (Day before)
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-text-secondary">
                    {sched.mealType === MealType.BREAKFAST ? (
                      <span className="text-primary font-medium">
                        Standard Default: 9:00 PM evening before &bull; Closes 10:00 PM
                      </span>
                    ) : (
                      'Same-day response window'
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(sched)}
                      className="h-8 px-2 text-xs"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" /> Configure
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Schedule Dialog */}
      {editingSchedule && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Configure Schedule: {formatDayOfWeek(editingSchedule.dayOfWeek)} {formatMealType(editingSchedule.mealType)}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-lavender/30 rounded-lg">
                <Label htmlFor="enabledSwitch" className="font-semibold">
                  Enable Scheduled Reminders
                </Label>
                <Switch
                  id="enabledSwitch"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sendTime">Send Reminder Time (24h)</Label>
                  <Input
                    id="sendTime"
                    type="time"
                    value={notifyTime}
                    onChange={(e) => setNotifyTime(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deadlineTime">Response Deadline (24h)</Label>
                  <Input
                    id="deadlineTime"
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="offset">Associated Meal Date Offset</Label>
                <select
                  id="offset"
                  value={mealOffset}
                  onChange={(e) => setMealOffset(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs"
                >
                  <option value={0}>Same day as meal</option>
                  <option value={1}>
                    Reminder sent on the evening BEFORE the meal (e.g. Breakfast)
                  </option>
                </select>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed pt-1">
                Timezone: Asia/Kolkata (+05:30). Students can update their meal choice until this exact deadline time.
              </p>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Validate & Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Explicit Overlap Acknowledgment Modal */}
      {pendingOverlap && (
        <Dialog open={!!pendingOverlap} onOpenChange={() => setPendingOverlap(null)}>
          <DialogContent className="border-warning/40">
            <DialogHeader>
              <div className="w-10 h-10 rounded-full bg-warning-light text-warning flex items-center justify-center mb-2">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base text-warning">
                Overlapping Response Windows Detected
              </DialogTitle>
              <DialogDescription className="text-xs">
                Review the concurrent meal response windows before confirming this schedule.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-lavender/50 rounded-lg space-y-1">
                <span className="font-bold text-text-primary block">Conflicting Window:</span>
                <p className="text-text-secondary">{pendingOverlap.overlapDescription}</p>
              </div>

              <div className="p-3 bg-background border border-border rounded-lg text-text-secondary leading-relaxed">
                <strong>Why this matters:</strong> Overlapping windows mean students will be prompted to submit intentions for multiple meals concurrently.
                If this overlap is intentional, click below to acknowledge and save.
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingOverlap(null)}
              >
                Go Back & Adjust Times
              </Button>
              <Button
                type="button"
                variant="warning"
                onClick={handleAcknowledgeOverlap}
              >
                Acknowledge & Confirm Overlap
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
