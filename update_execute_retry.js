const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const updated = content.replace(
`async function executeRequestWithRetry(
  fetchFn: () => Promise<Response>,
  maxRetries = 3
): Promise<Response> {`,
`import { ModelOrchestrator } from "./src/core/models/modelOrchestrator.js";

async function executeRequestWithRetry(
  fetchFn: () => Promise<Response>,
  maxRetries = 3,
  metricInfo?: { modelId: string, provider: string }
): Promise<Response> {
  const startTime = Date.now();
  let finalStatus = 200;
  let isRateLimit = false;`
).replace(
`      if (response.status === 429 && attempt < maxRetries) {
        attempt++;`,
`      if (response.status === 429 && attempt < maxRetries) {
        isRateLimit = true;
        if (metricInfo) ModelOrchestrator.recordMetric(metricInfo.modelId, metricInfo.provider, Date.now() - startTime, false, true);
        attempt++;`
).replace(
`      if (attempt >= maxRetries) {
        return response;
      }
    } catch (e: any) {
      if (attempt < maxRetries) {
        attempt++;
        let delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw e;
      }
    }
  }
}`,
`      if (attempt >= maxRetries) {
        if (metricInfo && !response.ok) ModelOrchestrator.recordMetric(metricInfo.modelId, metricInfo.provider, Date.now() - startTime, false, response.status === 429);
        else if (metricInfo && response.ok) ModelOrchestrator.recordMetric(metricInfo.modelId, metricInfo.provider, Date.now() - startTime, true, false);
        return response;
      }
      
      if (response.ok) {
        if (metricInfo) ModelOrchestrator.recordMetric(metricInfo.modelId, metricInfo.provider, Date.now() - startTime, true, false);
        return response;
      }
    } catch (e: any) {
      if (attempt < maxRetries) {
        attempt++;
        let delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        if (metricInfo) ModelOrchestrator.recordMetric(metricInfo.modelId, metricInfo.provider, Date.now() - startTime, false, false);
        throw e;
      }
    }
  }
}`
);

fs.writeFileSync('server.ts', updated);
console.log("Updated executeRequestWithRetry");
