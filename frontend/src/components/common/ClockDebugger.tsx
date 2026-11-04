// ============================================================
// Clock Debugger & Time Travel Widget
// ============================================================
// Allows evaluating deadline behavior interactively in the prototype.
// Collapsible and optional so it never obstructs mobile navigation.

import React, { useState, useEffect } from 'react';
import { getCurrentTime, setMockTime, resetClock, isMockTimeActive } from '@/lib/clock';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw, FastForward, X, ChevronDown, ChevronUp } from 'lucide-react';

export const ClockDebugger: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isMocked, setIsMocked] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Optional / collapsible state: defaults to minimized on mobile devices
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('messmate_clock_minimized');
      if (saved !== null) {
        return saved === 'true';
      }
      return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    } catch {
      return false;
    }
  });

  const toggleMinimized = (minimized: boolean) => {
    setIsMinimized(minimized);
    try {
      localStorage.setItem('messmate_clock_minimized', String(minimized));
    } catch {
      // Ignore storage errors in restricted private browsing
    }
  };

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

  // Minimized state: subtle, non-intrusive floating pill that never blocks mobile actions
  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => toggleMinimized(false)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/95 hover:bg-card border border-border shadow-md text-text-secondary hover:text-text-primary text-xs transition-all backdrop-blur-sm cursor-pointer group"
        title="Open Simulation Clock"
        aria-label="Open Simulation Clock"
      >
        <Clock className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
        <span className="font-medium text-[11px]">Clock</span>
        {isMocked && (
          <span className="w-2 h-2 rounded-full bg-warning ring-2 ring-warning/30 animate-pulse" title="Simulated time active" />
        )}
      </button>
    );
  }

  // Expanded state
  return (
    <div className="fixed bottom-4 right-4 z-40 bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-xl p-3 text-xs w-[calc(100vw-2rem)] max-w-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-text-primary">
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Simulation Clock:</span>
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
            className="h-6 px-1.5 text-[11px] gap-0.5"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <>
                <span>Hide</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>Adjust</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </Button>

          {/* Close / Minimize button */}
          <button
            type="button"
            onClick={() => toggleMinimized(true)}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-muted/50 transition-colors"
            title="Minimize Clock Widget"
            aria-label="Minimize Clock Widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
