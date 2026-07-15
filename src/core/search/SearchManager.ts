import { SearchResponse, SearchResult, SearchOptions } from "./types";

export abstract class SearchProvider {
  abstract name: string;
  abstract isConfigured(): boolean;
  abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  protected async fetchWithTimeout(url: string, options: any = {}, timeout = 7000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }
}

// Memory Cache
const searchCache = new Map<string, { data: SearchResponse, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class SearchManager {
  private providers: SearchProvider[] = [];
  private static instance: SearchManager;

  private constructor() {}

  public static getInstance(): SearchManager {
    if (!this.instance) this.instance = new SearchManager();
    return this.instance;
  }

  public registerProvider(provider: SearchProvider) {
    this.providers.push(provider);
    console.log(`[SearchManager] Registered provider: ${provider.name}`);
  }

  public async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const trimmedQuery = query.trim();
    
    // 1. Check Cache
    const cached = searchCache.get(trimmedQuery);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[SearchManager] Cache hit for: "${trimmedQuery}"`);
      return cached.data;
    }

    const startTime = Date.now();
    let lastError: any = null;

    // 2. Cascade Search (Failover)
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;

      try {
        console.log(`[SearchManager] Attempting search with: ${provider.name}`);
        const results = await provider.search(trimmedQuery, options);
        
        if (results && results.length > 0) {
          const response: SearchResponse = {
            results,
            provider: provider.name,
            latencyMs: Date.now() - startTime
          };
          
          // Save to Cache
          searchCache.set(trimmedQuery, { data: response, timestamp: Date.now() });
          return response;
        }
      } catch (err: any) {
        console.warn(`[SearchManager] ${provider.name} failed:`, err.message);
        lastError = err;
        // Continue to next provider
      }
    }

    throw lastError || new Error("No search results found and all providers failed.");
  }
}
