import { SearchProvider } from "../SearchManager";
import { SearchResult, SearchOptions } from "../types";

export class SerpAPIProvider extends SearchProvider {
  name = "SerpAPI";

  isConfigured(): boolean {
    const key = process.env.SERPAPI_API_KEY;
    return !!(key && key.trim() && !key.includes("..."));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const res = await this.fetchWithTimeout(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_API_KEY}`
    );

    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
    const json = await res.json();
    return (json.organic_results || []).slice(0, options?.limit || 6).map((r: any) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet
    }));
  }
}
