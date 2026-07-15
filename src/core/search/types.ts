export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  fullContent?: string;
  score?: number;
  publishedDate?: string;
}

export interface SearchOptions {
  limit?: number;
  depth?: 'basic' | 'advanced';
  days?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  provider: string;
  latencyMs: number;
}

export interface ProviderStatus {
  name: string;
  isEnabled: boolean;
  lastError?: string;
  lastErrorTime?: number;
  consecutiveFailures: number;
}
