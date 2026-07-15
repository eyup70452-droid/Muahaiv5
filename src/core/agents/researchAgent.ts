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
            stream: false
          })
        });

        const data = await response.json();
        
        // Basit bir parse işlemi (Gerçek senaryoda API'den yapılandırılmış veri gelir)
        return {
          query: topic,
          findings: [data.text.substring(0, 500) + "..."],
          sources: ["Internal Knowledge Graph", "Web Search Index v4"],
          summary: data.text
        };
      } catch (error) {
        logger.error("[Research] Araştırma sırasında hata:", error);
        throw error;
      }
    });
  });
}
