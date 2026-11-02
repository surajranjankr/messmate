// ============================================================
// Student Notification Centre
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '@/services/notificationService';
import { Notification } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { Bell, CheckCheck, ArrowRight, Sparkles, Inbox } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = () => {
    setNotifications(notificationService.getNotifications());
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
    loadNotifications();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
    loadNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <Badge variant="error" className="text-xs">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
          <p className="text-sm text-text-secondary">
            Meal reminder schedules and announcement updates
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="gap-2 self-start"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read</span>
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Inbox className="w-8 h-8 text-text-secondary mx-auto mb-2" />
            <h4 className="text-sm font-semibold">No notifications</h4>
            <p className="text-xs text-text-secondary">You are all caught up!</p>
          </Card>
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`transition-all border-border ${
                !notif.isRead
                  ? 'border-primary/40 bg-card shadow-xs'
                  : 'bg-card/60 opacity-90'
              }`}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    )}
                    <h4 className="text-sm font-bold text-text-primary">
                      {notif.title}
                    </h4>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[11px] text-text-secondary/80 block pt-1">
                    {formatDateTime(notif.createdAt)}
                  </span>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  {notif.mealInstanceId && (
                    <Link to={`/student/meals/${notif.mealInstanceId}`}>
                      <Button size="sm" variant="secondary" className="gap-1 text-xs h-8">
                        <span>Go to Meal</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}

                  {!notif.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-xs h-7 text-text-secondary"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
