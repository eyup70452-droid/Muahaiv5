import { SearchProvider } from "../SearchManager";
import { SearchResult, SearchOptions } from "../types";
import * as cheerio from "cheerio";

export class DuckDuckGoProvider extends SearchProvider {
  name = "DuckDuckGo";

  isConfigured(): boolean {
    return true; // Always available as fallback
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit || 6;
    
    // Attempt 1: DuckDuckGo Lite (POST/GET) - cleanest, most durable
    try {
      console.log(`[DuckDuckGoProvider] Scraping via Lite HTML protocol for: "${query}"`);
      const bodyParams = new URLSearchParams();
      bodyParams.append("q", query);
      bodyParams.append("kl", "us-en");
      
      const response = await fetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        body: bodyParams.toString()
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        const results: SearchResult[] = [];
        
        $("table").last().find("tr").each((i, row) => {
          const cells = $(row).find("td");
          if (cells.length === 1) {
            const linkEl = $(cells).find("a.result-link");
            if (linkEl.length > 0) {
              const title = linkEl.text().trim();
              let url = linkEl.attr("href") || "";
              
              if (url.includes("uddg=")) {
                const parts = url.split("uddg=");
                if (parts[1]) {
                  url = decodeURIComponent(parts[1].split("&")[0]);
                }
              }

              const nextRow = $(row).next();
              const snippet = nextRow.text().trim();
              
              if (title && url && !url.includes("duckduckgo.com/y.js")) {
                results.push({ title, url, snippet });
              }
            }
          }
        });

        if (results.length > 0) {
          console.log(`[DuckDuckGoProvider] Successfully retrieved ${results.length} results from Lite HTML.`);
          return results.slice(0, limit);
        }
      }
    } catch (liteErr: any) {
      console.warn("[DuckDuckGoProvider] Lite mode failed, trying HTML fallback:", liteErr.message);
    }

    // Attempt 2: DuckDuckGo Standard HTML Simple Protocol
    try {
      console.log(`[DuckDuckGoProvider] Scraping via Standard HTML protocol for: "${query}"`);
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        const results: SearchResult[] = [];

        $(".results_links_deep").each((i, el) => {
          const titleEl = $(el).find(".result__title a");
          const snippetEl = $(el).find(".result__snippet");
          
          if (titleEl.length > 0) {
            const title = titleEl.text().trim();
            let url = titleEl.attr("href") || "";
            if (url.includes("uddg=")) {
              const parts = url.split("uddg=");
              if (parts[1]) {
                url = decodeURIComponent(parts[1].split("&")[0]);
              }
            }
            const snippet = snippetEl.text().trim();

            if (title && url && !url.includes("duckduckgo.com/y.js")) {
              results.push({ title, url, snippet });
            }
          }
        });

        if (results.length > 0) {
          console.log(`[DuckDuckGoProvider] Successfully retrieved ${results.length} results from Standard HTML.`);
          return results.slice(0, limit);
        }
      }
    } catch (htmlErr: any) {
      console.warn("[DuckDuckGoProvider] HTML mode failed, trying library fallback:", htmlErr.message);
    }

    // Attempt 3: Library fallback
    try {
      console.log(`[DuckDuckGoProvider] Running library fallback...`);
      const { search, SafeSearchType } = await import("duck-duck-scrape");
      const res = await search(query, { safeSearch: SafeSearchType.STRICT });
      
      return (res.results || []).slice(0, limit).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.description
      }));
    } catch (err: any) {
      throw new Error(`DuckDuckGo scraper failed completely: ${err.message}`);
    }
  }
}
