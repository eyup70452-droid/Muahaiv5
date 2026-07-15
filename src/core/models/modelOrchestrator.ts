import fs from 'fs';
import path from 'path';

export interface ModelProvider {
  id: string; // openai, anthropic, google, openrouter, groq
  name: string;
  baseUrl: string;
  defaultModels: string[];
}

export interface ModelStats {
  modelId: string;
  provider: string;
  successCount: number;
  failCount: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  rateLimitHits: number;
  qualityScore: number; // 0-100
  costPer1MInputs: number;
  costPer1MOutputs: number;
  isHealthy: boolean;
  lastChecked: number;
}

const STATS_FILE = path.join(process.cwd(), 'tmp', 'model_stats.json');

export class ModelOrchestrator {
  static providers: Record<string, ModelProvider> = {
    'openai': { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'] },
    'google': { id: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModels: ['gemini-3.5-flash', 'gemini-3.1-pro-preview'] },
    'anthropic': { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
    'groq': { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModels: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'] },
    'openrouter': { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModels: ['anthropic/claude-3.5-sonnet', 'google/gemini-3.5-flash'] }
  };

  static init() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    if (!fs.existsSync(STATS_FILE)) {
      fs.writeFileSync(STATS_FILE, JSON.stringify({}));
    }
  }

  static getStats(): Record<string, ModelStats> {
    this.init();
    try {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }

  static saveStats(stats: Record<string, ModelStats>) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  }

  static getModelStats(modelId: string, provider: string): ModelStats {
    const stats = this.getStats();
    const key = `${provider}:${modelId}`;
    if (!stats[key]) {
      stats[key] = {
        modelId,
        provider,
        successCount: 0,
        failCount: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
        rateLimitHits: 0,
        qualityScore: 80, // Default baseline
        costPer1MInputs: this.estimateCost(modelId, true),
        costPer1MOutputs: this.estimateCost(modelId, false),
        isHealthy: true,
        lastChecked: Date.now()
      };
      this.saveStats(stats);
    }
    return stats[key];
  }

  private static estimateCost(modelId: string, isInput: boolean): number {
    const lower = modelId.toLowerCase();
    if (lower.includes('mini') || lower.includes('haiku') || lower.includes('flash') || lower.includes('8b')) {
      return isInput ? 0.15 : 0.60;
    }
    if (lower.includes('pro') || lower.includes('sonnet') || lower.includes('gpt-4o')) {
      return isInput ? 3.0 : 15.0;
    }
    return isInput ? 1.0 : 2.0;
  }

  static recordMetric(modelId: string, provider: string, latencyMs: number, success: boolean, isRateLimit: boolean = false) {
    const stats = this.getStats();
    const key = `${provider}:${modelId}`;
    if (!stats[key]) {
      stats[key] = this.getModelStats(modelId, provider);
    }

    if (success) {
      stats[key].successCount++;
      stats[key].totalLatencyMs += latencyMs;
      stats[key].averageLatencyMs = Math.round(stats[key].totalLatencyMs / stats[key].successCount);
      stats[key].isHealthy = true;
      stats[key].qualityScore = Math.min(100, stats[key].qualityScore + 1);
    } else {
      stats[key].failCount++;
      stats[key].qualityScore = Math.max(0, stats[key].qualityScore - 5);
      if (isRateLimit) {
        stats[key].rateLimitHits++;
      }
      
      // Mark unhealthy if failure rate is high recently
      if (stats[key].failCount > 3 && (stats[key].failCount / (stats[key].successCount + stats[key].failCount)) > 0.3) {
        stats[key].isHealthy = false;
      }
    }
    
    stats[key].lastChecked = Date.now();
    this.saveStats(stats);
  }

  // Find the best fallback model based on health, latency, and cost
  static getFallbackModel(originalModelId: string, originalProvider: string, mode: "fast" | "balanced" | "deep" | "agent" | "swarm"): { modelId: string, provider: string } {
    const stats = Object.values(this.getStats());
    
    // Filter healthy models
    let available = stats.filter(s => s.isHealthy && (s.modelId !== originalModelId || s.provider !== originalProvider));
    
    if (available.length === 0) {
      // If no stats yet or no healthy models found, provide sensible defaults based on mode
      // Prefer models that are not the original one
      if (mode === "fast") return { modelId: originalProvider === "openai" ? "gemini-3.5-flash" : "gpt-4o-mini", provider: originalProvider === "openai" ? "google" : "openai" };
      if (mode === "deep" || mode === "agent" || mode === "swarm") return { modelId: originalProvider === "anthropic" ? "gpt-4o" : "claude-3-5-sonnet-20241022", provider: originalProvider === "anthropic" ? "openai" : "anthropic" };
      return { modelId: originalProvider === "google" ? "gpt-4o-mini" : "gemini-3.5-flash", provider: originalProvider === "google" ? "openai" : "google" };
    }

    // Sort based on mode
    if (mode === "fast") {
      available.sort((a, b) => {
        if (a.averageLatencyMs > 0 && b.averageLatencyMs > 0) {
           return a.averageLatencyMs - b.averageLatencyMs;
        }
        return b.qualityScore - a.qualityScore;
      });
    } else if (mode === "deep" || mode === "agent" || mode === "swarm") {
      available.sort((a, b) => b.qualityScore - a.qualityScore);
    } else {
      // Balanced: score based on combination of quality and latency
      available.sort((a, b) => {
        const scoreA = a.qualityScore - (a.averageLatencyMs > 0 ? (a.averageLatencyMs / 100) : 0);
        const scoreB = b.qualityScore - (b.averageLatencyMs > 0 ? (b.averageLatencyMs / 100) : 0);
        return scoreB - scoreA;
      });
    }

    return { modelId: available[0].modelId, provider: available[0].provider };
  }

  static getBenchmarkReport(): string {
    const stats = Object.values(this.getStats());
    if (stats.length === 0) return "No benchmark data available yet.";

    stats.sort((a, b) => b.qualityScore - a.qualityScore);

    let report = "### Model Benchmark Report\n\n";
    report += "| Model | Provider | Quality | Avg Latency | Success Rate | Rate Limits | Cost (In/Out per 1M) |\n";
    report += "|-------|----------|---------|-------------|--------------|-------------|-----------------------|\n";
    
    for (const s of stats) {
      const total = s.successCount + s.failCount;
      const sr = total > 0 ? Math.round((s.successCount / total) * 100) : 0;
      report += `| ${s.modelId} | ${s.provider} | ${s.qualityScore}/100 | ${s.averageLatencyMs > 0 ? s.averageLatencyMs + 'ms' : 'N/A'} | ${sr}% | ${s.rateLimitHits} | $${s.costPer1MInputs}/$${s.costPer1MOutputs} |\n`;
    }
    return report;
  }
}
