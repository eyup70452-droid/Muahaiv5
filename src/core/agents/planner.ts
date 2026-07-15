import { runTool } from "../tools/runTool";
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

/**
 * Unifies the strategic project planning logic into a single module.
 */
export async function generateProjectPlan(userRequest: string): Promise<ProjectPlan> {
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
}

/**
 * Plans the sequential steps required to complete the user's master goal.
 * Uses the backend's ai_think_tool to generate a structured JSON array of steps.
 */
export async function planAgentTask(goal: string): Promise<string[]> {
  const plannerPrompt = `
    Analyze this overall master goal: "${goal}".
    Generate a clean, structured list of exactly 3 sequential, high-level steps to accomplish this goal.
    Each step must represent a clear action (e.g., "Search the web for current AI trends", "Analyze the key insights from findings", "Formulate a cohesive final report").
    
    You must output a JSON array of strings inside the 'response' key of your JSON.
    Example expected structure:
    ["Step 1 description", "Step 2 description", "Step 3 description"]

    Make sure the response is a clean JSON array of strings and nothing else.
  `;

  try {
    const result = await runTool("ai_think_tool", { prompt: plannerPrompt });
    if (result.success && result.result) {
      let responseText = result.result.response || "[]";
      if (typeof responseText === "string") {
        if (responseText.includes("```")) {
          responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        }
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
      } else if (Array.isArray(responseText)) {
        return responseText.map(String);
      }
    }
  } catch (err) {
    console.error("AI Planner failed to generate steps:", err);
  }

  return [
    `Search information about ${goal}`,
    `Analyze findings for ${goal}`,
    `Summarize results for ${goal}`
  ];
}

/**
 * Smart tool routing: Uses ai_think_tool to decide which tool is best suited for the given step.
 * Strictly returns one of the supported tool IDs.
 */
export async function routeToolForStep(step: string, goal: string): Promise<string> {
  const routerPrompt = `
    Analyze the following task step: "${step}" in the context of the overall goal: "${goal}".
    Decide which tool from this list is best suited to execute this step:

    1. "web_search_tool" - Best for searching information online, gathering current facts, news, definitions, or trends.
    2. "code_execution_tool" - Best for executing code, compiling scripts, performing math calculations, processing raw data arrays, or algorithm verification.
    3. "file_analysis_tool" - Best for parsing, analyzing, or summarizing loaded files, datasets, docs, CSV content, or logs.
    4. "ai_think_tool" - Best for general reasoning, text drafting, summarizing facts, strategic thinking, or structured content generation.

    Your response inside the 'response' key MUST be exactly one of these tool ID strings (no markdown, no quotes, no extra text):
    "web_search_tool", "code_execution_tool", "file_analysis_tool", "ai_think_tool"
  `;

  try {
    const result = await runTool("ai_think_tool", { prompt: routerPrompt });
    if (result.success && result.result) {
      const toolId = String(result.result.response).trim().replace(/['"`]/g, "");
      if (["web_search_tool", "code_execution_tool", "file_analysis_tool", "ai_think_tool"].includes(toolId)) {
        return toolId;
      }
    }
  } catch (err) {
    console.error("AI smart tool routing failed:", err);
  }

  const lower = step.toLowerCase();
  if (lower.includes("search") || lower.includes("find") || lower.includes("web") || lower.includes("google") || lower.includes("ara")) {
    return "web_search_tool";
  }
  if (lower.includes("code") || lower.includes("exec") || lower.includes("run") || lower.includes("compile") || lower.includes("calculate") || lower.includes("math") || lower.includes("hesap")) {
    return "code_execution_tool";
  }
  if (lower.includes("file") || lower.includes("parse") || lower.includes("csv") || lower.includes("dosya") || lower.includes("analiz")) {
    return "file_analysis_tool";
  }
  return "ai_think_tool";
}
