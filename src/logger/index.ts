import { getConfig } from "../config";
import { getLocalISOString } from "../utils/time";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get caller file path and line number from stack trace
 * @returns File path relative to src directory and line number, e.g., "handlers/completion.ts:42"
 */
function getCallerLocation(): string {
  try {
    const stack = new Error().stack;
    if (!stack) {
      return "unknown:0";
    }

    const lines = stack.split("\n");
    // Skip the first line (Error message) and find the first line that's not from logger/index.ts
    // The caller should be at index 3 or 4 (Error -> formatMessage -> logger method -> caller)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes("logger/index.ts") && line.trim()) {
        // Parse stack trace line format: "    at functionName (file:line:column)" or "    at file:line:column"
        const match = line.match(/\((.+):(\d+):(\d+)\)|at (.+):(\d+):(\d+)/);
        if (match) {
          const filePath = match[1] || match[4];
          const lineNumber = match[2] || match[5];

          if (filePath && lineNumber) {
            // Convert absolute path to relative path from src directory
            const srcIndex = filePath.indexOf("/src/");
            if (srcIndex !== -1) {
              const relativePath = filePath.substring(srcIndex + 5); // +5 to skip "/src/"
              return `${relativePath}:${lineNumber}`;
            }
            // If src not found, try to extract just the filename
            const fileName = filePath.split("/").pop() || filePath;
            return `${fileName}:${lineNumber}`;
          }
        }
      }
    }
    return "unknown:0";
  } catch {
    return "unknown:0";
  }
}

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
 * Format log message with timestamp, level, and caller location
 */
function formatMessage(
  level: LogLevel,
  message: string,
  ...args: unknown[]
): string {
  const timestamp = getLocalISOString();
  const location = getCallerLocation();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${location}]`;

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
