export type LogLevel = "INFO" | "API" | "METRICS" | "SYSTEM" | "WARN" | "ERROR";

export interface DevLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
}

type LogListener = (log: DevLog) => void;
const listeners = new Set<LogListener>();

const logQueue: DevLog[] = [];

// Pre-fill startup logs
const startUpLogs = [
  { level: "SYSTEM", category: "KERNEL", message: "AI Orchestrator OS master kernel initialized." },
  { level: "SYSTEM", category: "COMPILER", message: "TypeScript 5.8 compiler and Vite bundler linked successfully." },
  { level: "INFO", category: "WORKSPACE", message: "Local project workspace mapped." },
  { level: "INFO", category: "MODELS", message: "Multi-LLM routing engine listening for tasks." }
];

startUpLogs.forEach((l, idx) => {
  const log: DevLog = {
    id: `init-${idx}-${Date.now()}`,
    timestamp: new Date(Date.now() - (4 - idx) * 1000).toLocaleTimeString(),
    level: l.level as LogLevel,
    category: l.category,
    message: l.message
  };
  logQueue.push(log);
});

export function addDevLog(level: LogLevel, category: string, message: string) {
  const log: DevLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    level,
    category,
    message
  };
  logQueue.push(log);
  if (logQueue.length > 800) {
    logQueue.shift();
  }
  listeners.forEach(fn => fn(log));
}

export function getDevLogs(): DevLog[] {
  return [...logQueue];
}

export function subscribeDevLogs(listener: LogListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearDevLogs() {
  logQueue.length = 0;
  addDevLog("SYSTEM", "CONSOLE", "Developer logs cleared by operator.");
}
