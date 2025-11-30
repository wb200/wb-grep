import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level =
      (process.env.WBGREP_LOG_LEVEL as LogLevel) || options.level || "info";
    this.prefix = options.prefix || "";
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(message: string): string {
    return this.prefix ? `[${this.prefix}] ${message}` : message;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.log(chalk.gray(this.formatMessage(message)), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(chalk.blue(this.formatMessage(message)), ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(chalk.green(this.formatMessage(message)), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.log(chalk.yellow(this.formatMessage(message)), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(chalk.red(this.formatMessage(message)), ...args);
    }
  }

  plain(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(message, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
