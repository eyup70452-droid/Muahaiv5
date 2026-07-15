import * as cheerio from "cheerio";

export class Scraper {
  private static BLOCKED_HOSTS = [
    "localhost", "127.0.0.1", "0.0.0.0",
    "169.254.169.254", // AWS/GCP Metadata
  ];

  private static BLOCKED_PROTOCOLS = ["file:", "ftp:", "gopher:", "mailto:"];

  public static validateUrl(urlStr: string): void {
    try {
      const url = new URL(urlStr);
      
      if (this.BLOCKED_PROTOCOLS.includes(url.protocol)) {
        throw new Error(`Protocol ${url.protocol} is blocked for security reasons.`);
      }

      const hostname = url.hostname.toLowerCase();

      // Block local and private IPs
      if (
        this.BLOCKED_HOSTS.includes(hostname) ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) || // 172.16.0.0 - 172.31.255.255
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
      ) {
        throw new Error("Access to local/private networks is restricted (SSRF Protection).");
      }
    } catch (err: any) {
      throw new Error(`Invalid or restricted URL: ${err.message}`);
    }
  }

  public static async scrape(urlStr: string, timeout = 8000): Promise<string> {
    try {
      this.validateUrl(urlStr);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(urlStr, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return `[HTTP ${response.status}]`;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        return `[Unsupported content type: ${contentType}]`;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Aggressive cleaning
      $("script, style, noscript, iframe, svg, header, footer, nav, aside, link, .ads, #ads, .advertisement, .newsletter, .popup, .sidebar, .comments, .social-share, .footer-links").remove();

      // Content area selection
      let container = $("article, main, [role='main'], .post-content, .article-content, .entry-content, #content, .content, .main-content");
      if (container.length === 0) container = $("body");

      let extractedText = "";
      container.find("h1, h2, h3, h4, h5, h6, p, li, pre, blockquote").each((_, el) => {
        const tag = el.tagName.toLowerCase();
        const text = $(el).text().trim().replace(/\s+/g, " ");
        
        if (text && text.length > 3) {
          if (tag.startsWith("h")) {
            extractedText += `\n\n### ${text}\n\n`;
          } else if (tag === "li") {
            extractedText += `\n* ${text}`;
          } else if (tag === "pre") {
            extractedText += `\n\`\`\`\n${text}\n\`\`\`\n`;
          } else {
            extractedText += `\n${text}\n`;
          }
        }
      });

      if (!extractedText.trim()) {
        extractedText = container.text().trim().replace(/\s+/g, " ");
      }

      return extractedText.trim().replace(/\n{3,}/g, "\n\n").substring(0, 5000);
    } catch (err: any) {
      console.error(`[Scraper] Error scraping ${urlStr}:`, err.message);
      return `[Scraping Error: ${err.message}]`;
    }
  }
}
