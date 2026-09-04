type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private static instance: Logger;
  private isDev: boolean;

  private constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private print(entry: LogEntry) {
    if (this.isDev) {
      const styles = {
        info: 'color: #3b82f6; font-weight: bold',
        warn: 'color: #eab308; font-weight: bold',
        error: 'color: #ef4444; font-weight: bold',
        debug: 'color: #a855f7; font-weight: bold',
      };

      console.groupCollapsed(
        `%c[${entry.level.toUpperCase()}] ${entry.message}`,
        styles[entry.level]
      );
      if (entry.data) {
        console.log('Data:', entry.data);
      }
      console.log('Timestamp:', entry.timestamp);
      console.groupEnd();
    } else {
      // In production, we'd send this to Sentry/Datadog
      if (entry.level === 'error') {
        // console.error(JSON.stringify(entry)); // Minimal console noise in prod
        // TODO: window.Sentry?.captureException(...)
      }
    }
  }

  public info(message: string, data?: any) {
    this.print(this.formatMessage('info', message, data));
  }

  public warn(message: string, data?: any) {
    this.print(this.formatMessage('warn', message, data));
  }

  public error(message: string, error?: any) {
    this.print(this.formatMessage('error', message, error));
  }

  public debug(message: string, data?: any) {
    if (this.isDev) {
      this.print(this.formatMessage('debug', message, data));
    }
  }
}

export const logger = Logger.getInstance();
