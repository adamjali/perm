/**
 * Centralized Logging Library for Convex Functions
 *
 * Provides structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Consistent module prefixes
 * - PII redaction for sensitive fields
 * - Environment-aware output (dev vs production)
 *
 * @example
 * ```ts
 * import { createLogger } from './lib/logging';
 *
 * const log = createLogger('GoogleCalendar');
 *
 * log.info('Token refreshed successfully', { userId });
 * log.error('Failed to create event', { error, caseId });
 * ```
 *
 * Phase: P2-01 Fix - Structured Logging
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Unique identifier for the affected resource (case, user, etc.) */
  resourceId?: string;
  /** Additional context data */
  [key: string]: unknown;
}

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Fields that should be redacted in logs to protect sensitive data.
 * Reused from audit.ts for consistency.
 */
const SENSITIVE_FIELDS = new Set([
  // OAuth tokens
  'googleAccessToken',
  'googleRefreshToken',
  'token',
  'accessToken',
  'refreshToken',
  // Authentication secrets
  'password',
  'passwordHash',
  'secret',
  'apiKey',
  // PII that shouldn't be logged
  'employerFein',
  'ssn',
  'socialSecurityNumber',
  // Session tokens
  'sessionToken',
]);

/**
 * Current log level threshold.
 * In production, debug logs are suppressed.
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the minimum log level from environment.
 * Defaults to 'info' in production, 'debug' in development.
 */
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel;
  }
  // Default: 'debug' in dev, 'info' in production
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Redact sensitive fields from context object.
 * Returns a copy with sensitive values replaced by [REDACTED].
 */
function redactSensitive(context: LogContext): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_FIELDS.has(key)) {
      redacted[key] = value === null || value === undefined ? '[EMPTY]' : '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively redact nested objects
      redacted[key] = redactSensitive(value as LogContext);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Format log output with consistent structure.
 */
function formatLog(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase().padEnd(5);
  const prefix = `[${module}]`;

  if (context && Object.keys(context).length > 0) {
    const redactedContext = redactSensitive(context);
    return `${timestamp} ${levelUpper} ${prefix} ${message} ${JSON.stringify(redactedContext)}`;
  }

  return `${timestamp} ${levelUpper} ${prefix} ${message}`;
}

/**
 * Check if a log level should be output based on the minimum level.
 */
function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

// ============================================================================
// LOGGER FACTORY
// ============================================================================

/**
 * Create a logger instance for a specific module.
 *
 * @param module - Module name for log prefix (e.g., 'GoogleCalendar', 'Email', 'Auth')
 * @returns Logger instance with debug, info, warn, error methods
 *
 * @example
 * ```ts
 * const log = createLogger('GoogleCalendar');
 *
 * log.info('Token refreshed', { userId });
 * log.error('API call failed', { error: err.message, caseId });
 * ```
 */
export function createLogger(module: string): Logger {
  return {
    debug: (message: string, context?: LogContext) => {
      if (shouldLog('debug')) {
        console.log(formatLog('debug', module, message, context));
      }
    },

    info: (message: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.log(formatLog('info', module, message, context));
      }
    },

    warn: (message: string, context?: LogContext) => {
      if (shouldLog('warn')) {
        console.warn(formatLog('warn', module, message, context));
      }
    },

    error: (message: string, context?: LogContext) => {
      if (shouldLog('error')) {
        console.error(formatLog('error', module, message, context));
      }
    },
  };
}

// ============================================================================
// PRE-CONFIGURED LOGGERS
// ============================================================================

/**
 * Pre-configured loggers for common modules.
 * Import these directly for convenience.
 */
export const loggers = {
  auth: createLogger('Auth'),
  cases: createLogger('Cases'),
  calendar: createLogger('GoogleCalendar'),
  googleAuth: createLogger('GoogleAuth'),
  googleOAuth: createLogger('GoogleOAuth'),
  email: createLogger('Email'),
  push: createLogger('PushNotifications'),
  scheduler: createLogger('Scheduler'),
  deadline: createLogger('Deadline'),
  dashboard: createLogger('Dashboard'),
  audit: createLogger('Audit'),
  crypto: createLogger('Crypto'),
} as const;

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Log an info message with module prefix.
 * Convenience function for quick logging without creating a logger instance.
 */
export function logInfo(module: string, message: string, context?: LogContext): void {
  createLogger(module).info(message, context);
}

/**
 * Log an error message with module prefix.
 * Convenience function for quick logging without creating a logger instance.
 */
export function logError(module: string, message: string, context?: LogContext): void {
  createLogger(module).error(message, context);
}

/**
 * Log a warning message with module prefix.
 */
export function logWarn(module: string, message: string, context?: LogContext): void {
  createLogger(module).warn(message, context);
}

/**
 * Log a debug message with module prefix.
 */
export function logDebug(module: string, message: string, context?: LogContext): void {
  createLogger(module).debug(message, context);
}
