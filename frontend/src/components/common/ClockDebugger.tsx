// ============================================================
// Clock Debugger & Time Travel Widget
// ============================================================
// Allows evaluating deadline behavior interactively in the prototype.

import React, { useState, useEffect } from 'react';
import { getCurrentTime, setMockTime, resetClock, isMockTimeActive } from '@/lib/clock';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw, FastForward } from 'lucide-react';

export const ClockDebugger: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isMocked, setIsMocked] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const updateDisplay = () => {
    const now = getCurrentTime();
    setTimeStr(format(now, 'EEE, MMM d, yyyy - hh:mm:ss a'));
    setIsMocked(isMockTimeActive());
  };

  useEffect(() => {
    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAdvance = (hours: number) => {
    const current = getCurrentTime();
    const advanced = new Date(current.getTime() + hours * 60 * 60 * 1000);
    setMockTime(advanced);
    updateDisplay();
    // Dispatch custom event so listeners know clock shifted
    window.dispatchEvent(new Event('clock-tick'));
  };

  const handleReset = () => {
    resetClock();
    updateDisplay();
    window.dispatchEvent(new Event('clock-tick'));
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-card border border-border shadow-lg rounded-xl p-3 text-xs max-w-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-text-primary">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>Simulation Clock:</span>
          {isMocked ? (
            <Badge variant="warning" className="text-[10px] py-0 px-1.5">
              Simulated
            </Badge>
          ) : (
            <Badge variant="muted" className="text-[10px] py-0 px-1.5">
              System Time
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? 'Close' : 'Adjust'}
        </Button>
      </div>

      <div className="mt-1 font-mono text-text-secondary text-[11px] truncate">
        {timeStr}
      </div>

      {isOpen && (
        <div className="mt-3 pt-2 border-t border-border-light space-y-2">
          <p className="text-[11px] text-text-secondary leading-tight">
            Fast-forward time to test deadline locking and status transitions.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAdvance(1)}
            >
              <FastForward className="w-3 h-3 mr-1" /> +1h
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAdvance(4)}
            >
              <FastForward className="w-3 h-3 mr-1" /> +4h
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAdvance(24)}
            >
              <FastForward className="w-3 h-3 mr-1" /> +1 Day
            </Button>
            {isMocked && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleReset}
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
