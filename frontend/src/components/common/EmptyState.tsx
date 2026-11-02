import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-xl border border-dashed border-border my-4">
      <div className="p-3 bg-lavender rounded-full mb-3 text-primary">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-text-primary mb-1">{title}</h4>
      <p className="text-sm text-text-secondary max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
