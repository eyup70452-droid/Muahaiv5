import { ModelInfo } from "../../types";
import { systemEvents } from "../utils/systemEvents";

export type TaskCategory = "coding" | "reasoning" | "creative" | "vision" | "simple_qa" | "long_context";

export interface RoutingResult {
  selectedModel: ModelInfo;
  fallbackModels: ModelInfo[];
  reason: string;
  category: TaskCategory;
  score: number;
}

export function classifyTask(content: string): TaskCategory {
  const lowerContent = content.toLowerCase();
  
  // Scoring signals
  const hasCodeBlock = content.includes("```");
  const hasCodingKeywords = /\b(const|function|class|import|def|struct|void|return|public|private|interface|type|api|endpoint|sql|database|db|frontend|backend)\b/.test(lowerContent);
  const codingTerms = ["kod", "yazılım", "debug", "hata", "çözüm", "implement"];
  const isCoding = hasCodeBlock || hasCodingKeywords || codingTerms.some(term => lowerContent.includes(term));
  
  const reasoningTerms = ["neden", "niçin", "kanıtla", "analiz", "mantık", "düşün", "sebep", "strateji", "plan", "adım adım", "reasoning"];
  const isReasoning = reasoningTerms.some(term => lowerContent.includes(term)) || content.length > 500;
  
  const creativeTerms = ["hikaye", "şiir", "yaz", "blog", "yaratıcı", "senaryo", "betimle", "hayal et"];
  const isCreative = creativeTerms.some(term => lowerContent.includes(term));
  
  const visionTerms = ["görsel", "resim", "fotoğraf", "çizim", "ne görüyorsun", "betimle"];
  const isVision = visionTerms.some(term => lowerContent.includes(term));

  if (isCoding) return "coding";
  if (isVision) return "vision";
  if (isReasoning) return "reasoning";
  if (isCreative) return "creative";
  if (content.length > 2000) return "long_context";
  
  return "simple_qa";
}

export function routeModel(
  content: string, 
  models: ModelInfo[], 
  options: { freeOnly?: boolean; hasKeys?: string[] } = {}
): RoutingResult | null {
  if (models.length === 0) return null;

  const category = classifyTask(content);
  const activeModels = models.filter(m => m.status !== "inactive" && m.status !== "deprecated");
  // Filter models based on criteria
  const availableModels = activeModels.filter(m => {
    const id = m.id.toLowerCase();
    return true;
  });

  // Filter by keys and free-only mode
  let candidates = availableModels.filter(m => {
    // Must have a key provided by user (unless it's a built-in or doesn't need key)
    let hasKey = options.hasKeys ? options.hasKeys.includes(m.provider) : true;
    if (!hasKey) {
      // If the user has configured keys for OTHER providers, prefer those.
      // But if there are no models with keys at all, allow all so we can recommend the best one.
      const anyAvailableWithKey = availableModels.some(model => options.hasKeys?.includes(model.provider));
      if (anyAvailableWithKey) {
        return false;
      }
    }
    
    if (options.freeOnly) {
      const idLower = m.id.toLowerCase();
      const nameLower = (m.displayName || "").toLowerCase();
      const isPricedZero = (m.pricing?.inputPer1M === 0 && m.pricing?.outputPer1M === 0);
      const isMarkedFree = m.isFree || idLower.includes("free") || nameLower.includes("free") || m.provider === "groq" || m.provider === "nvidia"; // Groq and Nvidia provide free models in some cases, or their pricing is 0
      return isPricedZero || isMarkedFree;
    }
    return true;
  });

  // Automatically select models ending with (free) or :free or marked as free if any available
  // Only if they actually chose freeOnly, or if we want to prefer free models anyway?
  // Let's NOT force free models on everyone if freeOnly is false.
  if (options.freeOnly) {
    const freeCandidates = candidates.filter(m => {
      const idLower = m.id.toLowerCase();
      const nameLower = (m.displayName || "").toLowerCase();
      return m.isFree || idLower.includes("free") || nameLower.includes("free") || (m.pricing?.inputPer1M === 0 && m.pricing?.outputPer1M === 0);
    });

    if (freeCandidates.length > 0) {
      candidates = freeCandidates;
    }
  }

  if (candidates.length === 0 && options.freeOnly) {
    // If no free models available, maybe inform user or fall back to all?
    // User requested: "Bu görev için ücretsiz model bulunamadı" warning.
    return null; 
  }

  if (candidates.length === 0) return null;

  // Score models based on category suitability
  const scoredModels = candidates.map(model => {
    let score = 50; // Base score
    
    // Category match
    if (model.category?.includes(category as any)) score += 30;
    
    // Performance heuristics
    const modelLower = model.id.toLowerCase();
    if (category === "coding") {
      if (modelLower.includes("claude-3-5-sonnet") || modelLower.includes("gpt-4o")) score += 40;
      if (modelLower.includes("llama-3-1-405b") || modelLower.includes("deepseek-v3")) score += 35;
    } else if (category === "reasoning") {
      if (modelLower.includes("o1") || modelLower.includes("reasoner") || modelLower.includes("deepseek-r1")) score += 50;
      if (modelLower.includes("pro") || modelLower.includes("large")) score += 20;
    } else if (category === "long_context") {
      if (model.contextWindow >= 200000) score += 40;
    } else if (category === "vision") {
      if (model.category?.includes("vision" as any)) score += 50;
    }

    // Pricing/Cost consideration (Smart selection)
    if (!options.freeOnly) {
      if (model.isFree || model.id.toLowerCase().includes("free") || (model.pricing?.inputPer1M === 0 && model.pricing?.outputPer1M === 0)) {
        score += 20; // Bonus for free models to prioritize them if capabilities match
      } else {
        // Penalty for expensive models
        const costPer1M = (model.pricing?.inputPer1M || 0) + (model.pricing?.outputPer1M || 0);
        if (costPer1M > 30) score -= 15;
        else if (costPer1M > 10) score -= 5;
      }
    }

    return { model, score };
  });

  // Sort by score descending
  scoredModels.sort((a, b) => b.score - a.score);

  const selected = scoredModels[0].model;
  const fallbacks = scoredModels.slice(1, 4).map(s => s.model);

  let reason = "";
  switch(category) {
    case "coding": reason = `Kodlama görevi tespit edildi. En yüksek coding performansına sahip ${options.freeOnly ? "ücretsiz " : ""}model seçildi.`; break;
    case "reasoning": reason = `Derin düşünme gerektiren analiz görevi. Reasoning yeteneği güçlü ${options.freeOnly ? "ücretsiz " : ""}model tercih edildi.`; break;
    case "creative": reason = `Yaratıcı yazım görevi. Anlatımı güçlü ${options.freeOnly ? "ücretsiz " : ""}model seçildi.`; break;
    case "long_context": reason = `Geniş bağlam penceresi gerektiren uzun girdi. Yüksek context limitli ${options.freeOnly ? "ücretsiz " : ""}model seçildi.`; break;
    case "vision": reason = `Görsel analiz görevi. Vision kabiliyeti olan ${options.freeOnly ? "ücretsiz " : ""}model seçildi.`; break;
    default: reason = `Genel sohbet görevi için en uygun ${options.freeOnly ? "ücretsiz " : ""}model seçildi.`;
  }

  const result: RoutingResult = {
    selectedModel: selected,
    fallbackModels: fallbacks,
    reason,
    category,
    score: scoredModels[0].score
  };

  systemEvents.emit("routing", `Router: ${selected.displayName} (${category}) seçildi.`, result);

  return result;
}
