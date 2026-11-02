// ============================================================
// Injectable Clock for Deadline Testing
// ============================================================
// Provides a singleton clock that defaults to real time but can
// be overridden for testing deadline-related features.

let mockTime: Date | null = null;

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
}

/**
 * Reset the clock to use real system time.
 */
export function resetClock(): void {
  mockTime = null;
}

/**
 * Check if a mock time is currently active.
 */
export function isMockTimeActive(): boolean {
  return mockTime !== null;
}
