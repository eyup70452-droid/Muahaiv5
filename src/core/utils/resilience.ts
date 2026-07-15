import { systemEvents } from "./systemEvents";
import { logger } from "./systemLogger";

/**
 * AI Orchestrator OS Resilience & Optimization Engine
 * Centralizes reliability patterns, performance monitoring, and fault tolerance.
 */

/**
 * Circuit Breaker State
 */
const circuitStates: Record<string, {
  status: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  lastFailureTime: number;
}> = {};

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT = 30000; // 30s

/**
 * Cache Store
 */
const cacheStore: Record<string, {
  data: any;
  expiry: number;
}> = {};

export const resilience = {
  /**
   * Circuit Breaker Wrapper
   */
  async withCircuitBreaker<T>(key: string, task: () => Promise<T>): Promise<T> {
    const state = circuitStates[key] || { status: "CLOSED", failures: 0, lastFailureTime: 0 };
    circuitStates[key] = state;

    if (state.status === "OPEN") {
      if (Date.now() - state.lastFailureTime > CIRCUIT_RESET_TIMEOUT) {
        state.status = "HALF_OPEN";
        logger.info(`[Resilience] Circuit Breaker [${key}] entering HALF_OPEN state.`);
      } else {
        throw new Error(`Circuit Breaker [${key}] is OPEN. Request blocked for stability.`);
      }
    }

    try {
      const result = await task();
      if (state.status === "HALF_OPEN") {
        state.status = "CLOSED";
        state.failures = 0;
        logger.info(`[Resilience] Circuit Breaker [${key}] recovered to CLOSED.`);
      }
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailureTime = Date.now();
      
      if (state.failures >= CIRCUIT_THRESHOLD) {
        state.status = "OPEN";
        logger.error(`[Resilience] Circuit Breaker [${key}] tripped to OPEN!`);
        systemEvents.emit("system", `Kritik Servis Kesintisi: ${key} devre dışı bırakıldı.`);
      }
      throw error;
    }
  },

  /**
   * Cached Task Wrapper
   */
  async withCache<T>(key: string, ttl: number, task: () => Promise<T>): Promise<T> {
    const cached = cacheStore[key];
    if (cached && cached.expiry > Date.now()) {
      logger.debug(`[Resilience] Cache hit for [${key}]`);
      return cached.data;
    }

    const result = await task();
    cacheStore[key] = {
      data: result,
      expiry: Date.now() + ttl
    };
    return result;
  },

  /**
   * Robust fetch wrapper with exponential backoff, circuit breaking, and automatic event reporting.
   */
  async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3,
    initialBackoff = 1000
  ): Promise<Response> {
    return this.withCircuitBreaker(url, async () => {
      let lastError: any;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);
          
          if (response.ok) return response;
          
          // Handle specific retryable status codes
          if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          // Non-retryable error
          return response;
        } catch (error) {
          lastError = error;
          
          if (attempt === maxRetries) break;
          
          const delay = initialBackoff * Math.pow(2, attempt);
          logger.warn(`[Resilience] Attempt ${attempt + 1} failed for ${url}. Retrying in ${delay}ms...`);
          systemEvents.emit("system", `Servis hatası: Yeniden deneniyor... (Deneme ${attempt + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      logger.error(`[Resilience] All ${maxRetries + 1} attempts failed for ${url}.`, lastError);
      throw lastError;
    });
  },

  /**
   * Performance instrumentation wrapper.
   */
  async measure<T>(label: string, task: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await task();
      const end = performance.now();
      const duration = end - start;
      
      if (duration > 1000) {
        logger.warn(`[Perf] Slow task detected: ${label} took ${duration.toFixed(2)}ms`);
      } else {
        logger.debug(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const end = performance.now();
      logger.error(`[Perf] ${label} failed after ${(end - start).toFixed(2)}ms`);
      throw error;
    }
  },

  /**
   * Safe JSON parse helper to prevent crashes.
   */
  safeJsonParse<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      logger.error(`[Resilience] Failed to parse JSON:`, e);
      return fallback;
    }
  },

  /**
   * Debounce helper for UI stability.
   */
  debounce<T extends (...args: any[]) => any>(fn: T, ms = 300): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  },

  /**
   * Safe localStorage operations.
   */
  storage: {
    set<T>(key: string, value: T): void {
      try {
        localStorage.setItem(`ai_os_${key}`, JSON.stringify(value));
      } catch (e) {
        logger.error(`[Resilience] Storage write failed:`, e);
      }
    },
    get<T>(key: string, fallback: T): T {
      try {
        const item = localStorage.getItem(`ai_os_${key}`);
        return item ? JSON.parse(item) : fallback;
      } catch (e) {
        logger.error(`[Resilience] Storage read failed:`, e);
        return fallback;
      }
    }
  }
};
