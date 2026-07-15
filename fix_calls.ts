import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/executeRequestWithRetry\(\(\) => fetch\("https:\/\/api\.anthropic\.com\/v1\/messages", \{([\s\S]*?)\}\)\)/g, 'executeRequestWithRetry(() => fetch("https://api.anthropic.com/v1/messages", {$1}), 3, { modelId: actualModelId, provider: actualProviderId })');

content = content.replace(/executeRequestWithRetry\(\(\) => fetch\(apiUrl, \{([\s\S]*?)\}\)\)/g, 'executeRequestWithRetry(() => fetch(apiUrl, {$1}), 3, { modelId: actualModelId, provider: actualProviderId })');

fs.writeFileSync('server.ts', content);
console.log("Updated executeRequestWithRetry calls");
