const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const updated = content.replace(
`  const targetModel = {
    id: modelId,
    provider: providerId,
    contextWindow: 128000,
    pricing: { inputPer1M: 0, outputPer1M: 0 }
  };`,
`  let actualModelId = modelId;
  let actualProviderId = providerId;
  const fallback = ModelOrchestrator.getFallbackModel(modelId, providerId, aiMode);
  // Auto-fallback if the requested model is unhealthy
  const stats = ModelOrchestrator.getModelStats(modelId, providerId);
  if (!stats.isHealthy && fallback) {
    actualModelId = fallback.modelId;
    actualProviderId = fallback.provider;
    sendEvent("reasoning", { content: \`⚠️ [Model Health Check] 🔴 \${modelId} (\${providerId}) is unhealthy or failing. Auto-fallback to 🟢 \${actualModelId} (\${actualProviderId})\\n\\n\` });
  }

  const targetModel = {
    id: actualModelId,
    provider: actualProviderId,
    contextWindow: 128000,
    pricing: { inputPer1M: 0, outputPer1M: 0 }
  };`
).replace(/const officialModel = mapModelIdToOfficial\(modelId, providerId\);/g, `const officialModel = mapModelIdToOfficial(actualModelId, actualProviderId);`)
.replace(/if \(providerId === "openrouter"\)/g, `if (actualProviderId === "openrouter")`)
.replace(/if \(providerId === "openai"/g, `if (actualProviderId === "openai"`)
.replace(/if \(providerId === "anthropic"\)/g, `if (actualProviderId === "anthropic")`)
.replace(/if \(providerId === "google"\)/g, `if (actualProviderId === "google")`);

fs.writeFileSync('server.ts', updated);
console.log("Applied fallback logic");
