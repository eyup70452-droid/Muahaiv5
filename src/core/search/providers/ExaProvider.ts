import { SearchProvider } from "../SearchManager";
import { SearchResult, SearchOptions } from "../types";

export class ExaProvider extends SearchProvider {
  name = "Exa";

  isConfigured(): boolean {
    const key = process.env.EXA_API_KEY;
    return !!(key && key.trim() && !key.includes("..."));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const res = await this.fetchWithTimeout("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": process.env.EXA_API_KEY!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        numResults: options?.limit || 6,
        useAutoprompt: true
      })
    });

    if (!res.ok) throw new Error(`Exa HTTP ${res.status}`);
    const json = await res.json();
    return (json.results || []).map((r: any) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.text || r.snippet || "",
      score: r.score
    }));
  }
}
