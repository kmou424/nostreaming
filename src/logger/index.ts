import { getConfig } from "../config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the current log level from configuration
 */
function getLogLevel(): LogLevel {
  try {
    const config = getConfig();
    return config.logging?.level ?? "info";
  } catch {
    return "info";
  }
}

/**
 * Check if a log level should be output based on configuration
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format log message with timestamp and level
 */
function formatMessage(
  level: LogLevel,
  message: string,
  ...args: unknown[]
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (args.length === 0) {
    return `${prefix} ${message}`;
  }

  // Try to format with args, fallback to JSON stringify
  try {
    const formattedArgs = args.map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        return JSON.stringify(arg);
      }
      return String(arg);
    });
    return `${prefix} ${message} ${formattedArgs.join(" ")}`;
  } catch {
    return `${prefix} ${message} ${args.map(String).join(" ")}`;
  }
}

/**
 * Logger interface
 */
export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, ...args));
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, ...args));
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, ...args));
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, ...args));
    }
  },
};
