/**
 * Vitest setup for Convex tests
 *
 * Handles the "Write outside of transaction" unhandled rejections that occur
 * when scheduled functions run after the test transaction closes.
 * This is a known limitation of convex-test and these errors don't affect test results.
 */

// Note: vi is not directly used but this file is loaded by vitest

// Suppress unhandled rejection errors from convex-test scheduler issues
// These occur when ctx.scheduler.runAfter() functions run after test transaction closes
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    message.includes('Write outside of transaction') &&
    message.includes('_scheduled_functions')
  ) {
    // Silently ignore these specific errors from convex-test
    return;
  }
  originalConsoleError.apply(console, args);
};

// Handle unhandled promise rejections from scheduler
process.on('unhandledRejection', (reason: unknown) => {
  if (
    reason instanceof Error &&
    reason.message.includes('Write outside of transaction') &&
    reason.message.includes('_scheduled_functions')
  ) {
    // Silently ignore - this is a known convex-test limitation
    return;
  }
  // Re-throw other unhandled rejections
  throw reason;
});
