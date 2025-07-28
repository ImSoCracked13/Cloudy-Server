enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: any;
}

class Logger {
  private static formatMessage(logData: LogMessage): string {
    const { level, message, timestamp, context } = logData;
    
    // Format based on environment
    if (process.env.NODE_ENV === 'production') {
      return `[${timestamp}] ${level}: ${message}${context ? ` - ${JSON.stringify(context)}` : ''}`;
    } else {
      // Simplified format for development - just the message
      return `${message}${context ? ` ${JSON.stringify(context)}` : ''}`;
    }
  }

  static info(message: string, context?: any) {
    const logMessage = this.formatMessage({
      level: LogLevel.INFO,
      message,
      timestamp: new Date().toISOString(),
      context
    });
    console.log(logMessage);
  }

  static warn(message: string, context?: any) {
    const logMessage = this.formatMessage({
      level: LogLevel.WARN,
      message,
      timestamp: new Date().toISOString(),
      context
    });
    console.warn(logMessage);
  }

  static error(message: string, context?: any) {
    const logMessage = this.formatMessage({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date().toISOString(),
      context
    });
    console.error(logMessage);
  }

  static debug(message: string, context?: any) {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = this.formatMessage({
        level: LogLevel.DEBUG,
        message,
        timestamp: new Date().toISOString(),
        context
      });
      console.debug(logMessage);
    }
  }
}

export default Logger; 