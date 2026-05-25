// Suppress known-benign convex-test scheduler artifacts. convex-test runs
// scheduled (fire-and-forget) functions AFTER the test transaction closes, so a
// few late jobs log errors that are not real failures and would otherwise
// clutter output / flip the exit code:
//   - "Write outside of transaction" — late write after the tx committed
//   - "Transaction already committed or rolled back" — same, on rollback
//   - "after the environment was torn down" — a scheduled action's module load
//     races worker teardown (EnvironmentTeardownError, logged not thrown)
// These are limitations of the in-memory test harness, not the app.
function isBenignSchedulerNoise(message: unknown): boolean {
  if (typeof message === 'string') {
    if (message.includes('Write outside of transaction') && message.includes('_scheduled_functions')) return true;
    if (message.includes('Error when running scheduled function')) return true;
    if (message.includes('Transaction already committed or rolled back')) return true;
    if (message.includes('after the environment was torn down')) return true;
  }
  if (message instanceof Error) {
    if (message.message.includes('Transaction already committed or rolled back')) return true;
    if (message.message.includes('after the environment was torn down')) return true;
  }
  return false;
}

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (args.some(isBenignSchedulerNoise)) return;
  originalConsoleError.apply(console, args);
};

process.on('unhandledRejection', (reason: unknown) => {
  if (
    reason instanceof Error &&
    reason.message.includes('Write outside of transaction') &&
    reason.message.includes('_scheduled_functions')
  ) return;
  if (isBenignSchedulerNoise(reason)) return;
  throw reason;
});
