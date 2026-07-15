import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
`  const targetModel = {
    id: modelId,
    provider: providerId,
    contextWindow: 128000,
    pricing: { inputPer1M: 0, outputPer1M: 0 }
  };`,
`  let actualModelId = modelId;
  let actualProviderId = providerId;
  const stats = ModelOrchestrator.getModelStats(modelId, providerId);
  const fallback = ModelOrchestrator.getFallbackModel(modelId, providerId, aiMode as any);
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
);

content = content.replace(/const officialModel = mapModelIdToOfficial\(modelId, providerId\);/g, `const officialModel = mapModelIdToOfficial(actualModelId, actualProviderId);`);
content = content.replace(/!isKeyProvided\) throw new Error\(\`Provider API anahtarı eksik: \$\{providerId\}\`\);/g, `!isKeyProvided) throw new Error(\`Provider API anahtarı eksik: \${actualProviderId}\`);`);
content = content.replace(/providerId === "openai" \|\| providerId === "mistral"/g, `actualProviderId === "openai" || actualProviderId === "mistral"`);
content = content.replace(/\|\| providerId === "openrouter"/g, `|| actualProviderId === "openrouter"`);
content = content.replace(/\|\| providerId === "together"/g, `|| actualProviderId === "together"`);
content = content.replace(/\|\| providerId === "nvidia"/g, `|| actualProviderId === "nvidia"`);
content = content.replace(/\|\| providerId === "ollama"/g, `|| actualProviderId === "ollama"`);
content = content.replace(/\|\| providerId === "lmstudio"/g, `|| actualProviderId === "lmstudio"`);
content = content.replace(/\|\| providerId === "groq"/g, `|| actualProviderId === "groq"`);
content = content.replace(/\|\| providerId === "deepseek"/g, `|| actualProviderId === "deepseek"`);
content = content.replace(/if \(providerId === "openrouter"\)/g, `if (actualProviderId === "openrouter")`);
content = content.replace(/else if \(providerId === "mistral"\)/g, `else if (actualProviderId === "mistral")`);
content = content.replace(/else if \(providerId === "together"\)/g, `else if (actualProviderId === "together")`);
content = content.replace(/else if \(providerId === "nvidia"\)/g, `else if (actualProviderId === "nvidia")`);
content = content.replace(/else if \(providerId === "ollama"\)/g, `else if (actualProviderId === "ollama")`);
content = content.replace(/else if \(providerId === "lmstudio"\)/g, `else if (actualProviderId === "lmstudio")`);
content = content.replace(/else if \(providerId === "groq"\)/g, `else if (actualProviderId === "groq")`);
content = content.replace(/else if \(providerId === "deepseek"\)/g, `else if (actualProviderId === "deepseek")`);
content = content.replace(/if \(providerId === "anthropic"\)/g, `if (actualProviderId === "anthropic")`);
content = content.replace(/else if \(providerId === "anthropic"\)/g, `else if (actualProviderId === "anthropic")`);
content = content.replace(/else if \(providerId === "google"\)/g, `else if (actualProviderId === "google")`);
content = content.replace(/isValidCustomKey\(customApiKey, providerId\)/g, `isValidCustomKey(customApiKey, actualProviderId)`);
content = content.replace(/modelId,/g, `modelId: actualModelId, providerId: actualProviderId,`); // in metadata

fs.writeFileSync('server.ts', content);
console.log("Updated fallback logic");
