// Suppress "Write outside of transaction" errors from convex-test scheduler
// (known limitation: scheduled functions run after test transaction closes)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    message.includes('Write outside of transaction') &&
    message.includes('_scheduled_functions')
  ) return;
  originalConsoleError.apply(console, args);
};

process.on('unhandledRejection', (reason: unknown) => {
  if (
    reason instanceof Error &&
    reason.message.includes('Write outside of transaction') &&
    reason.message.includes('_scheduled_functions')
  ) return;
  throw reason;
});
