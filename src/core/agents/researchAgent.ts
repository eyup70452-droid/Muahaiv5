import { logger } from "../utils/systemLogger";
import { resilience } from "../utils/resilience";

export interface ResearchResult {
  query: string;
  findings: string[];
  sources: string[];
  summary: string;
}

export async function runDeepResearch(topic: string): Promise<ResearchResult> {
  const cacheKey = `research_${topic.substring(0, 100)}`;

  return resilience.withCache(cacheKey, 3600000, async () => {
    return resilience.measure("Research: DeepSearch", async () => {
      logger.info(`[Research] Derin araştırma başlatıldı: ${topic}`);
      
      try {
        const response = await resilience.fetchWithRetry("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Kullanıcı şu konuda derin bir teknik araştırma istiyor: "${topic}". 
            Lütfen önce bir araştırma planı yap, ardından anahtar bulguları listele ve en son teknik bir özet çıkar.`,
            mode: "deep",
            webSearchEnabled: true,
            stream: false
          })
        });

        const data = await response.json();
        
        // Extract real web search sources/domains if they are present in the web_search_tool results
        const sourcesSet = new Set<string>();
        
        if (data.toolCalls && Array.isArray(data.toolCalls)) {
          for (const call of data.toolCalls) {
            if (call.toolId === "web_search_tool" && call.output && Array.isArray(call.output.results)) {
              for (const item of call.output.results) {
                if (item.link) {
                  try {
                    const url = new URL(item.link);
                    sourcesSet.add(url.hostname.replace("www.", ""));
                  } catch (e) {
                    sourcesSet.add(item.link);
                  }
                } else if (item.title) {
                  sourcesSet.add(item.title);
                }
              }
            }
          }
        }
        
        // Also extract any domains/URLs mentioned in the model response text
        const urlRegex = /(https?:\/\/[^\s\)]+)/g;
        const matches = data.text.match(urlRegex);
        if (matches) {
          for (const match of matches) {
            try {
              const url = new URL(match);
              sourcesSet.add(url.hostname.replace("www.", ""));
            } catch (e) {}
          }
        }
        
        // Realistic and honest fallback of sources if no external results were triggered or extracted
        if (sourcesSet.size === 0) {
          sourcesSet.add("Bilişsel Bilgi Dağarcığı (Cognitive Knowledge Base)");
          sourcesSet.add("Model Yerleşik Teknik Dokümantasyonu");
        }
        
        const sources = Array.from(sourcesSet);
        
        // Better findings extraction by splitting text into meaningful bullet points or sentences
        const findings: string[] = [];
        const lines = data.text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if ((trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) && trimmed.length > 20) {
            findings.push(trimmed.replace(/^[-*\d\.]\s*/, ""));
          }
          if (findings.length >= 5) break;
        }
        
        if (findings.length === 0) {
          findings.push(data.text.substring(0, 300) + "...");
        }

        return {
          query: topic,
          findings,
          sources,
          summary: data.text
        };
      } catch (error) {
        logger.error("[Research] Araştırma sırasında hata:", error);
        throw error;
      }
    });
  });
}
