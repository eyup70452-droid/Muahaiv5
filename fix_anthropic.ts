import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /response = await executeRequestWithRetry\(\(\) => fetch\("https:\/\/api\.anthropic\.com\/v1\/messages", \{\s*method: "POST",\s*headers: \{\s*"Content-Type": "application\/json",\s*"x-api-key": customApiKey,\s*"anthropic-version": "2023-06-01"\s*\},\s*body: JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\)\);/g,
  'response = await executeRequestWithRetry(() => fetch("https://api.anthropic.com/v1/messages", {\n            method: "POST",\n            headers: {\n              "Content-Type": "application/json",\n              "x-api-key": customApiKey,\n              "anthropic-version": "2023-06-01"\n            },\n            body: JSON.stringify({$1})\n          }), 3, { modelId: actualModelId, provider: actualProviderId });'
);

fs.writeFileSync('server.ts', content);
console.log("Updated Anthropic calls");
