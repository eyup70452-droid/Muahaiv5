import { SearchProvider } from "../SearchManager";
import { SearchResult, SearchOptions } from "../types";

export class GoogleProvider extends SearchProvider {
  name = "Google Custom Search";

  isConfigured(): boolean {
    const key = process.env.GOOGLE_CSE_KEY || process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID || process.env.CX;
    return !!(key && cx && key.trim() && !key.includes("..."));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const key = process.env.GOOGLE_CSE_KEY || process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID || process.env.CX;
    
    const res = await this.fetchWithTimeout(
      `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=${options?.limit || 6}`
    );

    if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
    const json = await res.json();
    return (json.items || []).map((r: any) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet
    }));
  }
}
