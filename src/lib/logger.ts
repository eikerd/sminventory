/**
 * Client-side logger with structured logging and error tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500;
  private isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

  private format(level: LogLevel, message: string, context?: Record<string, any>, stack?: string): LogEntry {
    return {
      level,
      timestamp: new Date().toISOString(),
      message,
      context,
      stack,
    };
  }

  private store(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  debug(message: string, context?: Record<string, any>) {
    const entry = this.format('debug', message, context);
    this.store(entry);
    if (this.isDev) console.debug(`[DEBUG] ${message}`, context);
  }

  info(message: string, context?: Record<string, any>) {
    const entry = this.format('info', message, context);
    this.store(entry);
    console.info(`[INFO] ${message}`, context);
  }

  warn(message: string, context?: Record<string, any>) {
    const entry = this.format('warn', message, context);
    this.store(entry);
    console.warn(`[WARN] ${message}`, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>) {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorName: error.name,
        stack: error.stack,
      }),
    };

    const stack = error instanceof Error ? error.stack : undefined;
    const entry = this.format('error', message, errorContext, stack);
    this.store(entry);
    console.error(`[ERROR] ${message}`, error, context);
  }

  getLogs(level?: LogLevel, limit = 50): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter((log) => log.level === level);
    }
    return filtered.slice(-limit);
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();

// Setup global error handlers
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Uncaught error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    // Show toast notification for critical errors
    if (typeof document !== 'undefined') {
      const message = event.error?.message || 'An unexpected error occurred';
      // Use setTimeout to ensure toast library is ready
      setTimeout(() => {
        try {
          const { toast } = require('sonner');
          toast.error(`Error: ${message}`, {
            description: `Check console for details`,
            duration: 10000,
          });
        } catch (e) {
          // Toast library not yet loaded
          console.error('Toast error notification failed:', message);
        }
      }, 100);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason, {
      promise: event.promise,
    });

    // Show toast for unhandled rejections
    if (typeof document !== 'undefined') {
      const message = event.reason?.message || String(event.reason) || 'Unhandled promise rejection';
      setTimeout(() => {
        try {
          const { toast } = require('sonner');
          toast.error(`Async Error: ${message}`, {
            description: `Check console for details`,
            duration: 10000,
          });
        } catch (e) {
          console.error('Toast error notification failed:', message);
        }
      }, 100);
    }
  });
}
