// ============================================================
// Clock Debugger & Time Travel Widget
// ============================================================
// Allows evaluating deadline behavior interactively in the prototype.

import React, { useState, useEffect } from 'react';
import { getCurrentTime, setMockTime, resetClock, isMockTimeActive } from '@/lib/clock';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw, FastForward, ChevronUp, ChevronDown } from 'lucide-react';

export const ClockDebugger: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [shortTimeStr, setShortTimeStr] = useState<string>('');
  const [isMocked, setIsMocked] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const updateDisplay = () => {
    const now = getCurrentTime();
    setTimeStr(format(now, 'EEE, MMM d, yyyy - hh:mm:ss a'));
    setShortTimeStr(format(now, 'hh:mm a'));
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

  if (isMinimized) {
    return (
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 backdrop-blur border border-border shadow-md hover:bg-lavender text-xs font-semibold text-text-primary transition-all cursor-pointer"
          title="Click to expand simulation clock"
        >
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{shortTimeStr}</span>
          {isMocked ? (
            <Badge variant="warning" className="text-[9px] py-0 px-1 leading-none">
              Sim
            </Badge>
          ) : (
            <span className="w-2 h-2 rounded-full bg-success/80" />
          )}
          <ChevronUp className="w-3 h-3 text-text-secondary ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 bg-card/95 backdrop-blur border border-border shadow-lg rounded-xl p-3 text-xs w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-sm transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-text-primary truncate">
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold">Simulation Clock:</span>
          {isMocked ? (
            <Badge variant="warning" className="text-[10px] py-0 px-1.5 shrink-0">
              Simulated
            </Badge>
          ) : (
            <Badge variant="muted" className="text-[10px] py-0 px-1.5 shrink-0">
              System Time
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px]"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? 'Close' : 'Adjust'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-text-secondary hover:text-text-primary"
            onClick={() => setIsMinimized(true)}
            title="Minimize clock"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
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
              className="h-7 text-xs flex-1 sm:flex-none"
              onClick={() => handleAdvance(1)}
            >
              <FastForward className="w-3 h-3 mr-1" /> +1h
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1 sm:flex-none"
              onClick={() => handleAdvance(4)}
            >
              <FastForward className="w-3 h-3 mr-1" /> +4h
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1 sm:flex-none"
              onClick={() => handleAdvance(24)}
            >
              <FastForward className="w-3 h-3 mr-1" /> +1 Day
            </Button>
            {isMocked && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs flex-1 sm:flex-none"
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
