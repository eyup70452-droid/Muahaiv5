import { logger } from "../utils/systemLogger";
import { resilience } from "../utils/resilience";

export interface TaskStep {
  id: string;
  title: string;
  description: string;
  estimatedEffort: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
}

export interface ProjectPlan {
  goal: string;
  complexity: number;
  steps: TaskStep[];
  suggestedModels: string[];
}

export async function generateProjectPlan(userRequest: string): Promise<ProjectPlan> {
  const cacheKey = `plan_${userRequest.substring(0, 100)}`;
  
  return resilience.withCache(cacheKey, 3600000, async () => {
    return resilience.measure("Planner: GeneratePlan", async () => {
      logger.info(`[Planner] Proje planlaması başlatıldı: "${userRequest.substring(0, 50)}..."`);
      
      try {
        const response = await resilience.fetchWithRetry("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Sen bir AI Proje Yöneticisisin. Aşağıdaki isteği analiz et ve bunu teknik alt görevlere böl. 
            Yanıtını mutlaka şu JSON yapısında ver (başka yazı ekleme):
            {
              "goal": "Hedef özeti",
              "complexity": 1-10 arası zorluk,
              "steps": [
                { "id": "1", "title": "Başlık", "description": "Açıklama", "estimatedEffort": "low/medium/high", "status": "pending" }
              ],
              "suggestedModels": ["Model Adları"]
            }
            
            İstek: "${userRequest}"`,
            mode: "balanced",
            stream: false
          })
        });

        const data = await response.json();
        
        // Basit bir JSON temizleme/parse işlemi
        let plan: ProjectPlan;
        try {
          const jsonMatch = data.text.match(/\{[\s\S]*\}/);
          plan = JSON.parse(jsonMatch ? jsonMatch[0] : data.text);
        } catch (e) {
          logger.warn("[Planner] API yanıtı JSON olarak ayrıştırılamadı, manuel şema oluşturuluyor.");
          plan = {
            goal: "Karmaşık Görev Analizi",
            complexity: 7,
            steps: [
              { id: "1", title: "Gereksinim Analizi", description: "İsteğin teknik detaylarının netleştirilmesi.", estimatedEffort: "low", status: "completed" },
              { id: "2", title: "Mimari Tasarım", description: "Sistem bileşenlerinin belirlenmesi.", estimatedEffort: "medium", status: "pending" },
              { id: "3", title: "Geliştirme Fazı", description: "Kod bloklarının ve mantıksal katmanların inşası.", estimatedEffort: "high", status: "pending" }
            ],
            suggestedModels: ["Claude 3.5 Sonnet", "GPT-4o"]
          };
        }
        
        return plan;
      } catch (error) {
        logger.error("[Planner] Planlama sırasında hata:", error);
        throw error;
      }
    });
  });
}
