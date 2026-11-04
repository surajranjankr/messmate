// ============================================================
// Injectable Clock for Deadline Testing
// ============================================================
// Provides a singleton clock that defaults to real time but can
// be overridden for testing deadline-related features.

const SIMULATION_CLOCK_STORAGE_KEY = 'messmate_simulation_clock';

let mockTime: Date | null = (() => {
  try {
    const saved = localStorage.getItem(SIMULATION_CLOCK_STORAGE_KEY);
    if (saved) {
      const parsed = new Date(saved);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } catch {
    // Local storage unavailable
  }
  return null;
})();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SIMULATION_CLOCK_STORAGE_KEY) {
      if (e.newValue) {
        const parsed = new Date(e.newValue);
        if (!isNaN(parsed.getTime())) {
          mockTime = parsed;
        }
      } else {
        mockTime = null;
      }
      window.dispatchEvent(new Event('clock-tick'));
    }
  });
}

/**
 * Get the current time. Returns the mock time if set,
 * otherwise returns the real current time.
 */
export function getCurrentTime(): Date {
  if (mockTime !== null) {
    return new Date(mockTime.getTime());
  }
  return new Date();
}

/**
 * Set a mock time for testing deadline logic.
 * All calls to getCurrentTime() will return this value until reset.
 */
export function setMockTime(date: Date): void {
  mockTime = new Date(date.getTime());
  try {
    localStorage.setItem(SIMULATION_CLOCK_STORAGE_KEY, mockTime.toISOString());
  } catch {
    // Ignore
  }
}

/**
 * Reset the clock to use real system time.
 */
export function resetClock(): void {
  mockTime = null;
  try {
    localStorage.removeItem(SIMULATION_CLOCK_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Check if a mock time is currently active.
 */
export function isMockTimeActive(): boolean {
  return mockTime !== null;
}
