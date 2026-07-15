
type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'system';

export interface SystemLog {
  id: string;
  timestamp: string;
  ms: number;
  level: LogLevel;
  message: string;
  details?: any;
  source: string;
}

class SystemLogger {
  private logs: SystemLog[] = [];
  private maxLogs = 500;
  private listeners: ((logs: SystemLog[]) => void)[] = [];

  constructor() {
    this.interceptConsole();
  }

  private interceptConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const safeStringify = (obj: any) => {
      try {
        if (typeof obj === 'string') return obj;
        if (typeof obj !== 'object' || obj === null) return String(obj);
        return JSON.stringify(obj, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        , 2);
      } catch (e) {
        return '[Complex Object]';
      }
    };

    console.log = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ');
      this.addLog('info', msg, args.length > 1 ? args : args[0], 'Console');
      originalLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ');
      this.addLog('error', msg, args.length > 1 ? args : args[0], 'Console');
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ');
      this.addLog('warn', msg, args.length > 1 ? args : args[0], 'Console');
      originalWarn.apply(console, args);
    };
  }

  public addLog(level: LogLevel, message: string, details?: any, source: string = 'System') {
    const now = new Date();
    const log: SystemLog = {
      id: `log-${now.getTime()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now.toLocaleTimeString('tr-TR', { hour12: false }),
      ms: now.getMilliseconds(),
      level,
      message,
      details,
      source
    };

    this.logs = [log, ...this.logs].slice(0, this.maxLogs);
    this.notify();
  }

  public info(message: string, details?: any, source: string = 'System') {
    this.addLog('info', message, details, source);
  }

  public warn(message: string, details?: any, source: string = 'System') {
    this.addLog('warn', message, details, source);
  }

  public error(message: string, details?: any, source: string = 'System') {
    this.addLog('error', message, details, source);
  }

  public debug(message: string, details?: any, source: string = 'System') {
    this.addLog('debug', message, details, source);
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }

  public subscribe(listener: (logs: SystemLog[]) => void) {
    this.listeners.push(listener);
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getLogs() {
    return this.logs;
  }

  public clear() {
    this.logs = [];
    this.notify();
  }
}

export const logger = new SystemLogger();
