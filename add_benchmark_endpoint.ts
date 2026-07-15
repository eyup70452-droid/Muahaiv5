import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const benchmarkEndpoint = `
// Model Benchmark API
app.get("/api/models/benchmark", (req, res) => {
  try {
    const { ModelOrchestrator } = require("./src/core/models/modelOrchestrator.js");
    res.json({ success: true, report: ModelOrchestrator.getBenchmarkReport(), stats: ModelOrchestrator.getStats() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
`;

if (!content.includes('/api/models/benchmark')) {
  content = content.replace('app.post("/api/chat"', benchmarkEndpoint + '\napp.post("/api/chat"');
  fs.writeFileSync('server.ts', content);
  console.log("Added benchmark endpoint");
}
