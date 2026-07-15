import { SearchProvider } from "../SearchManager";
import { SearchResult, SearchOptions } from "../types";

export class TavilyProvider extends SearchProvider {
  name = "Tavily";

  isConfigured(): boolean {
    const key = process.env.TAVILY_API_KEY;
    return !!(key && key.trim() && !key.includes("..."));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const res = await this.fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: options?.limit || 6,
        search_depth: options?.depth || "advanced"
      })
    });

    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    const json = await res.json();
    return (json.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      score: r.score
    }));
  }
}
