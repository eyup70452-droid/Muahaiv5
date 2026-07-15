import { logger } from "../utils/systemLogger";
import { generateProjectPlan } from "./planner";
import { runDeepResearch } from "./researchAgent";
import { systemEvents } from "../utils/systemEvents";
import { resilience } from "../utils/resilience";

export interface SwarmUpdate {
  agent: string;
  status: string;
  content?: string;
}

export async function executeSwarmTask(
  request: string, 
  onUpdate: (update: SwarmUpdate) => void
): Promise<string> {
  return resilience.measure("Swarm: CollectiveIntelligence", async () => {
    logger.info(`[Swarm] Kolektif zeka operasyonu başlatıldı: "${request.substring(0, 50)}..."`);
    systemEvents.emit("agent", `Swarm: Operasyon başlatıldı - ${request.substring(0, 30)}...`);
    
    try {
      // Phase 1: Planning
      onUpdate({ agent: "Planner", status: "Analiz ediliyor ve strateji oluşturuluyor..." });
      const plan = await generateProjectPlan(request);
      onUpdate({ agent: "Planner", status: "Plan oluşturuldu.", content: `Hedef: ${plan.goal}` });

      // Phase 2: Research (Simulated or focused on first step)
      onUpdate({ agent: "Researcher", status: "Teknik dökümantasyon ve kaynak taraması yapılıyor..." });
      const research = await runDeepResearch(plan.steps[0].title);
      onUpdate({ agent: "Researcher", status: "Araştırma tamamlandı.", content: research.summary.substring(0, 100) + "..." });

      // Phase 3: Synthesis
      onUpdate({ agent: "Orchestrator", status: "Bulgular birleştiriliyor ve çözüm üretiliyor..." });
      
      const response = await resilience.fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Aşağıdaki verileri kullanarak kapsamlı bir çözüm sentezle:
          
          İstek: ${request}
          Plan: ${JSON.stringify(plan.steps)}
          Araştırma Özeti: ${research.summary}
          
          Lütfen nihai bir teknik rapor ve uygulama adımları sun.`,
          mode: "balanced",
          stream: false
        })
      });

      const data = await response.json();
      systemEvents.emit("agent", "Swarm: Görev başarıyla tamamlandı.");
      return data.text;

    } catch (error) {
      logger.error("[Swarm] Operasyon sırasında kritik hata:", error);
      throw error;
    }
  });
}
