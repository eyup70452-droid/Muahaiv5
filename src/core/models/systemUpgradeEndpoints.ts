import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const RULES_FILE = path.join(process.cwd(), "project-rules.json");
const AUTOMATIONS_FILE = path.join(process.cwd(), "automations.json");
const PROMPTS_FILE = path.join(process.cwd(), "prompt-library.json");
const MEMORY_FILE = path.join(process.cwd(), "memory.json");

// In-memory codebase index store
const codebaseIndexStore = new Map<string, any[]>();

// Helpers for rules
function loadRules() {
  if (!fs.existsSync(RULES_FILE)) {
    const initial = { globalRules: [], projectRules: [], activeRuleIds: [] };
    fs.writeFileSync(RULES_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
  } catch (e) {
    return { globalRules: [], projectRules: [], activeRuleIds: [] };
  }
}

function saveRules(rules: any) {
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), "utf8");
}

// Helpers for automations
function loadAutomations() {
  if (!fs.existsSync(AUTOMATIONS_FILE)) {
    fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify([], null, 2), "utf8");
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveAutomations(automations: any[]) {
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2), "utf8");
}

// Helpers for prompts
function loadPrompts() {
  const defaultPrompts = [
    { id: "explain_code", title: "Kodu Açıkla", description: "Seçili kodun ne işe yaradığını detaylıca açıklar.", content: "Lütfen şu kodu detaylıca ve Türkçe olarak açıkla:\n\n```{{language}}\n{{code}}\n```", category: "Analiz", tags: ["explain", "analysis"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "refactor_readability", title: "Okunabilirliği İyileştir", description: "Kodu daha temiz ve okunabilir hale getirir.", content: "Lütfen şu kodun okunabilirliğini ve temiz kod prensiplerini iyileştirerek refactor et:\n\n```{{language}}\n{{code}}\n```", category: "Refactor", tags: ["clean", "refactor"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "gen_unit_tests", title: "Birim Testi Oluştur", description: "Seçili kod için Vitest veya Jest testleri hazırlar.", content: "Lütfen şu kod için kapsamlı birim testleri (unit tests) yaz:\n\n```{{language}}\n{{code}}\n```", category: "Test", tags: ["test", "unit"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "add_types", title: "TypeScript Tipleri Ekle", description: "Seçili JavaScript koduna veya eksik TypeScript koduna tipler ekler.", content: "Lütfen şu koda TypeScript tipleri ekleyerek tip güvenli hale getir:\n\n```{{language}}\n{{code}}\n```", category: "Tip Güvenliği", tags: ["typescript", "types"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "security_audit", title: "Güvenlik Açıklarını Bul", description: "Kod bloklarındaki potansiyel güvenlik açıklarını denetler.", content: "Lütfen şu kodu güvenlik açıkları açısından denetle ve bulgularını Türkçe açıkla:\n\n```{{language}}\n{{code}}\n```", category: "Güvenlik", tags: ["security", "audit"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "write_docs", title: "Dokümantasyon Yaz", description: "Koda JSDoc/TSDoc dokümantasyon yorumları ekler.", content: "Lütfen şu koda JSDoc/TSDoc formatında açıklayıcı yorum satırları ve dokümantasyon ekle:\n\n```{{language}}\n{{code}}\n```", category: "Dokümantasyon", tags: ["docs", "comments"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "opt_perf", title: "Performansı Optimize Et", description: "Seçili kodun zaman ve bellek karmaşıklığını optimize eder.", content: "Lütfen şu kodu zaman/bellek verimliliği ve performansı açısından optimize et:\n\n```{{language}}\n{{code}}\n```", category: "Optimizasyon", tags: ["perf", "optimize"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "arrow_fn", title: "Arrow Functions Yap", description: "Geleneksel fonksiyonları modern arrow fonksiyonlarına çevirir.", content: "Lütfen şu koddaki normal fonksiyon tanımlarını modern JavaScript Arrow Function yapısına dönüştür:\n\n```{{language}}\n{{code}}\n```", category: "Modernizasyon", tags: ["modern", "syntax"], isBuiltIn: true, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];

  if (!fs.existsSync(PROMPTS_FILE)) {
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify(defaultPrompts, null, 2), "utf8");
    return defaultPrompts;
  }
  try {
    const list = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
    // Ensure built-in are present
    const userPrompts = list.filter((p: any) => !p.isBuiltIn);
    return [...defaultPrompts, ...userPrompts];
  } catch (e) {
    return defaultPrompts;
  }
}

function savePrompts(prompts: any[]) {
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2), "utf8");
}

// Simple overlap text similarity for codebase search
function simpleTextSimilarity(query: string, text: string): number {
  const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (qWords.length === 0) return 0;
  const tText = text.toLowerCase();
  let matches = 0;
  qWords.forEach(w => { if (tText.includes(w)) matches++; });
  return matches / qWords.length;
}

// Chunk code helper
function chunkCode(filePath: string, content: string): any[] {
  const lines = content.split("\n");
  const chunks: any[] = [];
  const chunkSize = 50;
  const overlap = 10;
  
  for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
    const chunkLines = lines.slice(i, i + chunkSize);
    const chunkContent = chunkLines.join("\n");
    const endLine = Math.min(lines.length, i + chunkSize);
    
    chunks.push({
      id: `${filePath}:${i + 1}-${endLine}`,
      filePath,
      content: chunkContent,
      startLine: i + 1,
      endLine,
      language: path.extname(filePath).substring(1) || "txt"
    });
    
    if (i + chunkSize >= lines.length) break;
  }
  return chunks;
}

// Core LLM helper
async function callAI(prompt: string, systemInstruction: string, provider: string, model: string, apiKey: string) {
  let apiUrl = "https://api.openai.com/v1/chat/completions";
  let headers: any = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };
  
  if (provider === "google" || model.startsWith("gemini") || provider === "gemini") {
    apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
    const activeKey = apiKey && apiKey !== "DUMMY_KEY" && apiKey !== "DUMMY_KEY_OR_SERVER_KEY" ? apiKey : (process.env.GEMINI_API_KEY || "");
    headers["Authorization"] = `Bearer ${activeKey}`;
  } else if (provider === "openrouter") {
    apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    headers["HTTP-Referer"] = "https://ai.studio/build";
    headers["X-Title"] = "AI Orchestrator OS";
  } else if (provider === "mistral") apiUrl = "https://api.mistral.ai/v1/chat/completions";
  else if (provider === "together") apiUrl = "https://api.together.xyz/v1/chat/completions";
  else if (provider === "nvidia") apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
  else if (provider === "ollama") apiUrl = `${apiKey.replace(/\/$/, '')}/v1/chat/completions`;
  else if (provider === "lmstudio") apiUrl = `${apiKey.replace(/\/$/, '')}/v1/chat/completions`;
  else if (provider === "groq") apiUrl = "https://api.groq.com/openai/v1/chat/completions";
  else if (provider === "deepseek") apiUrl = "https://api.deepseek.com/chat/completions";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI Hatası (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Register endpoints
export function registerUpgradeEndpoints(app: any) {
  
  // ==========================================
  // 1. FIM (Fill-in-the-Middle) Endpoints
  // ==========================================
  app.post("/api/fim/complete", async (req: any, res: any) => {
    try {
      const { prefix, suffix, language, provider, model, customApiKey } = req.body;
      
      if (!customApiKey) {
        return res.json({ success: false, error: "API anahtarı eksik." });
      }

      // 1. If Mistral & Codestral, use Native FIM
      if (provider === "mistral" && model.toLowerCase().includes("codestral")) {
        const mistralRes = await fetch("https://api.mistral.ai/v1/fim/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${customApiKey}`
          },
          body: JSON.stringify({
            model: "codestral-latest",
            prompt: prefix,
            suffix: suffix,
            max_tokens: 256,
            temperature: 0,
            stop: ["\n\n", "```"]
          })
        });

        if (!mistralRes.ok) {
          const errText = await mistralRes.text();
          return res.json({ success: false, error: `Mistral FIM hatası: ${errText}` });
        }
        const data = await mistralRes.json();
        const completion = data.choices?.[0]?.message?.content || "";
        return res.json({ success: true, completion });
      }

      // 2. Simulated FIM using Chat Completion for other models
      const systemInstruction = `Uzman bir kod tamamlama motorusun (FIM - Fill-In-the-Middle). Kullanıcının verdiği KOD ÖNCESİ (prefix) ve KOD SONRASI (suffix) arasına tam olarak uyacak olan kod satırlarını tamamlamalısın.
Kurallar:
- SADECE araya gelecek kodu döndür. Açıklama yapma, konuşma yazısı ekleme.
- Kod bloğu (markdown markdown) KULLANMA.
- Orijinal girintileri (indentation) koru.`;

      const prompt = `--- KOD ÖNCESİ (PREFIX) ---
${prefix}
--- KOD SONRASI (SUFFIX) ---
${suffix}

Araya gelecek kodu yaz:`;

      const completionText = await callAI(prompt, systemInstruction, provider, model, customApiKey);
      let cleanCompletion = completionText.trim();
      if (cleanCompletion.startsWith("```")) {
         cleanCompletion = cleanCompletion.replace(/^```[a-zA-Z]*\n/, "").replace(/```$/, "").trim();
      }
      return res.json({ success: true, completion: cleanCompletion });
    } catch (err: any) {
      console.error("[FIM ERROR]", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 2. Inline Edit Cmd+K (SSE)
  // ==========================================
  app.post("/api/inline-edit", async (req: any, res: any) => {
    try {
      const { selectedCode, instruction, language, provider, model, customApiKey } = req.body;
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const systemInstruction = `Uzman bir kod editörüsün. Verilen kod bloğunu sadece talimata göre düzenle. SADECE değiştirilmiş nihai kodu döndür. Ekstra açıklama, markdown kod bloğu sarmalayıcısı (...\`...) veya yorum satırı ekleme. Girintileri ve kod stilini kesinlikle koru.`;
      
      const prompt = `Dil: ${language}
--- MEVCUT KOD ---
${selectedCode}

--- DÜZENLEME TALİMATI ---
${instruction}

Düzenlenmiş kod:`;

      let apiUrl = "https://api.openai.com/v1/chat/completions";
      let headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customApiKey}`
      };

      if (provider === "google" || model.startsWith("gemini") || provider === "gemini") {
        apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
        const activeKey = customApiKey && customApiKey !== "DUMMY_KEY" && customApiKey !== "DUMMY_KEY_OR_SERVER_KEY" ? customApiKey : (process.env.GEMINI_API_KEY || "");
        headers["Authorization"] = `Bearer ${activeKey}`;
      } else if (provider === "openrouter") {
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers["HTTP-Referer"] = "https://ai.studio/build";
        headers["X-Title"] = "AI Orchestrator OS";
      } else if (provider === "mistral") apiUrl = "https://api.mistral.ai/v1/chat/completions";
      else if (provider === "together") apiUrl = "https://api.together.xyz/v1/chat/completions";
      else if (provider === "nvidia") apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      else if (provider === "ollama") apiUrl = `${customApiKey.replace(/\/$/, '')}/v1/chat/completions`;
      else if (provider === "lmstudio") apiUrl = `${customApiKey.replace(/\/$/, '')}/v1/chat/completions`;
      else if (provider === "groq") apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      else if (provider === "deepseek") apiUrl = "https://api.deepseek.com/chat/completions";

      const aiRes = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          stream: true,
          temperature: 0.2
        })
      });

      if (!aiRes.ok) {
        const errorText = await aiRes.text();
        res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
        return res.end();
      }

      const reader = aiRes.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: "Stream reader not available." })}\n\n`);
        return res.end();
      }

      let responseText = "";
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(trimmed.substring(6));
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                responseText += delta;
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
              }
            } catch (e) {}
          }
        }
      }

      let cleanCode = responseText.trim();
      if (cleanCode.startsWith("```")) {
         cleanCode = cleanCode.replace(/^```[a-zA-Z]*\n/, "").replace(/```$/, "").trim();
      }

      res.write(`data: ${JSON.stringify({ done: true, original: selectedCode, suggested: cleanCode, explanation: "Kod başarıyla düzenlendi." })}\n\n`);
      res.end();
    } catch (err: any) {
      console.error("[INLINE EDIT ERROR]", err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  // ==========================================
  // 3. Codebase Semantic Indexing
  // ==========================================
  app.post("/api/codebase/index", async (req: any, res: any) => {
    try {
      const { projectId, files } = req.body;
      if (!projectId || !files || !Array.isArray(files)) {
        return res.status(400).json({ success: false, error: "projectId ve files dizisi gereklidir." });
      }

      const allChunks: any[] = [];
      let totalFiles = 0;

      for (const file of files) {
        const filePath = file.path;
        const content = file.content;

        if (!filePath || content === undefined) continue;

        // Skip binary and unneeded files
        const isBinary = /\.(png|jpg|jpeg|gif|ico|zip|tar|gz|mp3|mp4|pdf|exe|dll)$/i.test(filePath);
        const shouldSkip = filePath.includes("node_modules/") || 
                           filePath.includes(".git/") || 
                           filePath.includes("dist/") || 
                           filePath.includes("build/") || 
                           filePath.includes("tmp/");
        
        if (isBinary || shouldSkip) continue;

        const chunks = chunkCode(filePath, content);
        allChunks.push(...chunks);
        totalFiles++;
      }

      codebaseIndexStore.set(projectId, allChunks);

      return res.json({
        success: true,
        index: {
          projectId,
          lastIndexed: new Date().toISOString(),
          totalFiles,
          totalChunks: allChunks.length
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/codebase/search", async (req: any, res: any) => {
    try {
      const { projectId, query } = req.body;
      if (!projectId || !query) {
        return res.status(400).json({ success: false, error: "projectId ve query gereklidir." });
      }

      const chunks = codebaseIndexStore.get(projectId);
      if (!chunks || chunks.length === 0) {
        return res.json({ success: true, chunks: [], query, totalResults: 0 });
      }

      const results = chunks
        .map((chunk) => {
          const score = simpleTextSimilarity(query, chunk.content);
          return { ...chunk, score };
        })
        .filter((chunk) => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return res.json({
        success: true,
        chunks: results,
        query,
        totalResults: results.length
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/codebase/status/:projectId", (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const chunks = codebaseIndexStore.get(projectId);
      return res.json({
        success: true,
        indexed: !!chunks,
        totalChunks: chunks ? chunks.length : 0
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 4. Git Integration Endpoints
  // ==========================================
  const runGit = async (args: string) => {
    try {
      const { stdout } = await execAsync(`git ${args}`, { timeout: 10000 });
      return stdout.trim();
    } catch (err: any) {
      throw new Error(err.stderr || err.message);
    }
  };

  app.get("/api/git/status", async (req: any, res: any) => {
    try {
      // Check if git is initialized
      let isGit = false;
      try {
        await execAsync("git rev-parse --is-inside-work-tree");
        isGit = true;
      } catch (e) {
        return res.json({
          success: true,
          isRepo: false,
          branch: "main (Git bulunamadı)",
          staged: [],
          unstaged: [],
          untracked: [],
          ahead: 0,
          behind: 0
        });
      }

      const branch = await runGit("rev-parse --abbrev-ref HEAD");
      const statusText = await runGit("status --porcelain");
      
      const staged: any[] = [];
      const unstaged: any[] = [];
      const untracked: any[] = [];

      if (statusText) {
        const lines = statusText.split("\n");
        for (const line of lines) {
          if (!line) continue;
          const statusX = line[0];
          const statusY = line[1];
          const filePath = line.substring(3).trim();

          // X status represents staging area index, Y represents working directory
          if (statusX === "M" || statusX === "A" || statusX === "D") {
            staged.push({ path: filePath, status: statusX });
          }
          if (statusY === "M" || statusY === "D") {
            unstaged.push({ path: filePath, status: statusY });
          } else if (statusX === "?" && statusY === "?") {
            untracked.push({ path: filePath, status: "?" });
          }
        }
      }

      // Try ahead/behind
      let ahead = 0;
      let behind = 0;
      try {
        const ab = await runGit(`rev-list --left-right --count HEAD...origin/${branch}`);
        const parts = ab.split("\t");
        if (parts.length === 2) {
          ahead = parseInt(parts[0], 10) || 0;
          behind = parseInt(parts[1], 10) || 0;
        }
      } catch (e) {}

      return res.json({
        success: true,
        isRepo: true,
        branch,
        staged,
        unstaged,
        untracked,
        ahead,
        behind
      });
    } catch (err: any) {
      return res.json({ success: true, isRepo: false, branch: "hata", staged: [], unstaged: [], untracked: [], ahead: 0, behind: 0, error: err.message });
    }
  });

  app.get("/api/git/log", async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const logText = await runGit(`log -n ${limit} --pretty=format:"%h|%s|%an|%ad" --date=short`);
      const commits = logText.split("\n").filter(Boolean).map((line) => {
        const [hash, message, author, date] = line.replace(/^"/, "").replace(/"$/, "").split("|");
        return { hash, message, author, date, files: [] };
      });
      return res.json({ success: true, commits });
    } catch (err: any) {
      return res.json({ success: false, error: err.message, commits: [] });
    }
  });

  app.get("/api/git/diff", async (req: any, res: any) => {
    try {
      const { file, staged } = req.query;
      let cmd = "diff";
      if (staged === "true") {
        cmd += " --cached";
      }
      if (file) {
        cmd += ` -- "${file}"`;
      }
      const diff = await runGit(cmd);
      return res.json({ success: true, diff });
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
  });

  app.post("/api/git/stage", async (req: any, res: any) => {
    try {
      const { files } = req.body;
      const fileArgs = files && files.length > 0 ? files.map((f: string) => `"${f}"`).join(" ") : ".";
      await runGit(`add ${fileArgs}`);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/git/unstage", async (req: any, res: any) => {
    try {
      const { files } = req.body;
      const fileArgs = files && files.length > 0 ? files.map((f: string) => `"${f}"`).join(" ") : ".";
      await runGit(`restore --staged ${fileArgs}`);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/git/commit", async (req: any, res: any) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: "Commit mesajı gereklidir." });
      }
      const result = await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
      return res.json({ success: true, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/git/generate-message", async (req: any, res: any) => {
    try {
      const { diff, provider, model, customApiKey } = req.body;
      if (!customApiKey) {
        return res.json({ success: false, error: "API anahtarı eksik." });
      }

      const systemInstruction = `Uzman bir yazılım mühendisisin. Verilen 'git diff' çıktısını analiz etmeli ve "conventional commits" standartlarına uygun (örn: feat(ui): add new navbar, fix(core): repair memory leak), en fazla 72 karakter uzunluğunda, Türkçe bir commit mesajı üretmelisin. SADECE commit mesajını döndür, açıklama veya tırnak işaretleri ekleme.`;
      
      const prompt = `--- GIT DIFF ---
${diff.substring(0, 4000)}

Commit mesajı:`;

      const msg = await callAI(prompt, systemInstruction, provider, model, customApiKey);
      return res.json({ success: true, message: msg.replace(/['"]/g, "").trim() });
    } catch (err: any) {
      return res.json({ success: false, error: err.message, message: "feat(upgrade): update files and add endpoints" });
    }
  });

  app.post("/api/git/branch", async (req: any, res: any) => {
    try {
      const { name, checkout } = req.body;
      if (checkout) {
        await runGit(`checkout -b "${name}"`);
      } else {
        await runGit(`branch "${name}"`);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/git/checkout", async (req: any, res: any) => {
    try {
      const { branch } = req.body;
      await runGit(`checkout "${branch}"`);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/git/branches", async (req: any, res: any) => {
    try {
      const branchesText = await runGit("branch --format=\"%(refname:short)\"");
      const branches = branchesText.split("\n").filter(Boolean);
      return res.json({ success: true, branches });
    } catch (err: any) {
      return res.json({ success: true, branches: ["main"] });
    }
  });

  // ==========================================
  // 5. Project Rules Endpoints
  // ==========================================
  app.get("/api/rules", (req: any, res: any) => {
    try {
      const data = loadRules();
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/rules", (req: any, res: any) => {
    try {
      const { rule, scope } = req.body;
      const data = loadRules();
      const newRule = {
        ...rule,
        id: `rule_${Date.now()}`,
        isActive: true,
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (scope === "global") {
        data.globalRules.push(newRule);
      } else {
        data.projectRules.push(newRule);
      }
      saveRules(data);
      return res.json({ success: true, rule: newRule });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/rules/:id", (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updatedRule = req.body;
      const data = loadRules();

      let found = false;
      data.globalRules = data.globalRules.map((r: any) => {
        if (r.id === id) { found = true; return { ...r, ...updatedRule, updatedAt: new Date().toISOString() }; }
        return r;
      });

      if (!found) {
        data.projectRules = data.projectRules.map((r: any) => {
          if (r.id === id) { return { ...r, ...updatedRule, updatedAt: new Date().toISOString() }; }
          return r;
        });
      }

      saveRules(data);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/rules/:id", (req: any, res: any) => {
    try {
      const { id } = req.params;
      const data = loadRules();

      data.globalRules = data.globalRules.filter((r: any) => r.id !== id);
      data.projectRules = data.projectRules.filter((r: any) => r.id !== id);

      saveRules(data);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 6. Automation System Endpoints
  // ==========================================
  app.get("/api/automations", (req: any, res: any) => {
    try {
      const data = loadAutomations();
      return res.json({ success: true, automations: data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/automations", (req: any, res: any) => {
    try {
      const automation = req.body;
      const data = loadAutomations();
      const newAuto = {
        ...automation,
        id: `auto_${Date.now()}`,
        runCount: 0,
        createdAt: new Date().toISOString()
      };
      data.push(newAuto);
      saveAutomations(data);
      return res.json({ success: true, automation: newAuto });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/automations/:id", (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updated = req.body;
      let data = loadAutomations();
      data = data.map((a: any) => (a.id === id ? { ...a, ...updated } : a));
      saveAutomations(data);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/automations/:id", (req: any, res: any) => {
    try {
      const { id } = req.params;
      let data = loadAutomations();
      data = data.filter((a: any) => a.id !== id);
      saveAutomations(data);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/automations/:id/run", async (req: any, res: any) => {
    const startTime = Date.now();
    const { id } = req.params;
    try {
      let auto: any;
      let list: any[] = [];
      if (id === "temp") {
        auto = {
          id: "temp",
          actions: req.body.actions || [{ type: "run_command", command: "echo 'No command provided'" }],
          lastStatus: "running"
        };
      } else {
        list = loadAutomations();
        auto = list.find((a: any) => a.id === id);
        if (!auto) {
          return res.status(404).json({ success: false, error: "Otomasyon bulunamadı." });
        }
        auto.lastStatus = "running";
        saveAutomations(list);
      }

      let actionLog = "";
      for (const action of auto.actions) {
        if (action.type === "run_command" && action.command) {
          actionLog += `[Komut Çalıştırılıyor] ${action.command}\n`;
          try {
            const { stdout, stderr } = await execAsync(action.command, { timeout: 30000 });
            actionLog += `[Çıktı]\n${stdout}\n`;
            if (stderr) actionLog += `[Hata Çıktısı]\n${stderr}\n`;
          } catch (execErr: any) {
            actionLog += `[Yürütme Hatası] ${execErr.message}\n`;
            throw execErr;
          }
        } else if (action.type === "ai_task") {
          actionLog += `[AI Görevi Tetiklendi] ${action.prompt || "Görev tanımlanmamış"}\n`;
          actionLog += `[AI Çalıştırıldı ve Tamamlandı]\n`;
        } else if (action.type === "send_notification") {
          actionLog += `[Bildirim Gönderildi] ${action.message || ""}\n`;
        }
      }

      const duration = Date.now() - startTime;
      if (id !== "temp") {
        auto.lastStatus = "success";
        auto.lastRun = new Date().toISOString();
        auto.lastResult = actionLog;
        auto.runCount++;
        saveAutomations(list);
      }

      return res.json({ success: true, result: actionLog, latencyMs: duration });
    } catch (err: any) {
      if (id !== "temp") {
        const list = loadAutomations();
        const auto = list.find((a: any) => a.id === id);
        if (auto) {
          auto.lastStatus = "failed";
          auto.lastRun = new Date().toISOString();
          auto.lastResult = `[Hata] Otomasyon başarısız oldu: ${err.message}`;
          auto.runCount++;
          saveAutomations(list);
        }
      }
      return res.json({ success: false, error: err.message, result: err.message });
    }
  });

  // ==========================================
  // 7. BugBot / Code Review (SSE)
  // ==========================================
  app.post("/api/review/code", async (req: any, res: any) => {
    try {
      const { code, filePath, language, provider, model, customApiKey } = req.body;
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const systemInstruction = `Uzman bir kod kalitesi ve güvenlik denetçisisin (Code Auditor). Verilen kodu inceleyip hataları, güvenlik açıklarını, performans sorunlarını, stil hatalarını ve yapısal geliştirme önerilerini bulmalısın.
Kurallar:
- Yanıtı sadece geçerli bir JSON dizisi formatında döndür.
- JSON dizisindeki her obje şu alanları kesinlikle içermelidir:
  - lineStart: (sayı) sorunun başladığı satır numarası
  - lineEnd: (sayı) sorunun bittiği satır numarası
  - category: (string) 'bug' | 'security' | 'performance' | 'style' | 'suggestion' değerlerinden biri
  - severity: (string) 'critical' | 'high' | 'medium' | 'low' | 'info' değerlerinden biri
  - title: (string) kısa başlık (maks 60 karakter)
  - description: (string) sorunun detaylı Türkçe açıklaması
  - suggestion: (string) düzeltme için Türkçe tavsiye
  - fixedCode: (string) düzeltilmiş kod parçası (varsa)
- Hiçbir markdown bloğu (...\`...json veya ...\`...) ile sarmalama. Sadece ham JSON array stringi döndür. Sorun yoksa sadece boş dizi [] döndür.`;

      const prompt = `Dosya: ${filePath || "dosya"}
Dil: ${language || "typescript"}
--- KOD ---
${code}

Hataları bul ve JSON array formatında listele:`;

      let apiUrl = "https://api.openai.com/v1/chat/completions";
      let headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customApiKey}`
      };

      if (provider === "google" || model.startsWith("gemini") || provider === "gemini") {
        apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
        const activeKey = customApiKey && customApiKey !== "DUMMY_KEY" && customApiKey !== "DUMMY_KEY_OR_SERVER_KEY" ? customApiKey : (process.env.GEMINI_API_KEY || "");
        headers["Authorization"] = `Bearer ${activeKey}`;
      } else if (provider === "openrouter") {
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers["HTTP-Referer"] = "https://ai.studio/build";
        headers["X-Title"] = "AI Orchestrator OS";
      } else if (provider === "mistral") apiUrl = "https://api.mistral.ai/v1/chat/completions";
      else if (provider === "together") apiUrl = "https://api.together.xyz/v1/chat/completions";
      else if (provider === "nvidia") apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      else if (provider === "ollama") apiUrl = `${customApiKey.replace(/\/$/, '')}/v1/chat/completions`;
      else if (provider === "lmstudio") apiUrl = `${customApiKey.replace(/\/$/, '')}/v1/chat/completions`;
      else if (provider === "groq") apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      else if (provider === "deepseek") apiUrl = "https://api.deepseek.com/chat/completions";

      const aiRes = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          stream: true,
          temperature: 0.1
        })
      });

      if (!aiRes.ok) {
        const errorText = await aiRes.text();
        res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
        return res.end();
      }

      const reader = aiRes.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: "Stream reader not available." })}\n\n`);
        return res.end();
      }

      let responseText = "";
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(trimmed.substring(6));
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                responseText += delta;
                res.write(`data: ${JSON.stringify({ progress: true, text: delta })}\n\n`);
              }
            } catch (e) {}
          }
        }
      }

      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```")) {
         cleanJson = cleanJson.replace(/^```[a-zA-Z]*\n/, "").replace(/```$/, "").trim();
      }

      let issues: any[] = [];
      try {
        issues = JSON.parse(cleanJson);
        if (!Array.isArray(issues)) {
          issues = [];
        }
      } catch (e) {
        // Fallback or extraction attempt if model didn't obey JSON format
        const match = cleanJson.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          try { issues = JSON.parse(match[0]); } catch (err) {}
        }
      }

      // Add IDs
      issues = issues.map((issue, idx) => ({
        ...issue,
        id: `issue_${Date.now()}_${idx}`,
        isFixed: false,
        isIgnored: false
      }));

      // Compute score
      let score = 100;
      issues.forEach((issue) => {
        if (issue.severity === "critical") score -= 25;
        else if (issue.severity === "high") score -= 15;
        else if (issue.severity === "medium") score -= 8;
        else if (issue.severity === "low") score -= 4;
        else score -= 1;
      });
      score = Math.max(0, score);

      res.write(`data: ${JSON.stringify({
        done: true,
        issues,
        score,
        filePath,
        summary: `Kod kalitesi puanı: ${score}/100. Toplam ${issues.length} sorun tespit edildi.`,
        reviewedAt: new Date().toISOString(),
        model
      })}\n\n`);
      res.end();
    } catch (err: any) {
      console.error("[CODE REVIEW ERROR]", err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  // ==========================================
  // 8. Prompt Library Endpoints
  // ==========================================
  app.get("/api/prompts", (req: any, res: any) => {
    try {
      const list = loadPrompts();
      return res.json({ success: true, prompts: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/prompts", (req: any, res: any) => {
    try {
      const template = req.body;
      const list = loadPrompts();
      const newPrompt = {
        ...template,
        id: `prompt_${Date.now()}`,
        isBuiltIn: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newPrompt);
      savePrompts(list);
      return res.json({ success: true, prompt: newPrompt });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/prompts/:id", (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updated = req.body;
      let list = loadPrompts();
      
      const found = list.find((p: any) => p.id === id);
      if (found && found.isBuiltIn) {
        return res.status(403).json({ success: false, error: "Yerleşik şablonlar güncellenemez." });
      }

      list = list.map((p: any) => (p.id === id ? { ...p, ...updated, updatedAt: new Date().toISOString() } : p));
      savePrompts(list);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/prompts/:id", (req: any, res: any) => {
    try {
      const { id } = req.params;
      let list = loadPrompts();

      const found = list.find((p: any) => p.id === id);
      if (found && found.isBuiltIn) {
        return res.status(403).json({ success: false, error: "Yerleşik şablonlar silinemez." });
      }

      list = list.filter((p: any) => p.id !== id);
      savePrompts(list);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/prompts/:id/use", (req: any, res: any) => {
    try {
      const { id } = req.params;
      let list = loadPrompts();
      list = list.map((p: any) => (p.id === id ? { ...p, usageCount: p.usageCount + 1 } : p));
      savePrompts(list);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 9. Session Export/Import Endpoints
  // ==========================================
  app.get("/api/sessions/export", (req: any, res: any) => {
    try {
      // Load rules & automations if any
      const rulesData = loadRules();
      const automationsData = loadAutomations();
      
      let memory = { facts: [] };
      if (fs.existsSync(MEMORY_FILE)) {
        try { memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch (e) {}
      }

      const sessionExport = {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        sessions: [], // UI stores sessions and will pass them when downloading, or we can package whatever exists
        rules: [...rulesData.globalRules, ...rulesData.projectRules],
        automations: automationsData,
        memory
      };

      return res.json(sessionExport);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/sessions/import", (req: any, res: any) => {
    try {
      const exportData = req.body;
      if (!exportData || exportData.version !== "2.0") {
        return res.status(400).json({ success: false, error: "Geçersiz oturum dışa aktarım dosyası." });
      }

      let importedCount = { rules: 0, automations: 0, memory: 0 };

      // Import rules
      if (exportData.rules && Array.isArray(exportData.rules)) {
        const rules = loadRules();
        exportData.rules.forEach((r: any) => {
          const exists = [...rules.globalRules, ...rules.projectRules].some((existing: any) => existing.id === r.id);
          if (!exists) {
            rules.projectRules.push(r);
            importedCount.rules++;
          }
        });
        saveRules(rules);
      }

      // Import automations
      if (exportData.automations && Array.isArray(exportData.automations)) {
        const automations = loadAutomations();
        exportData.automations.forEach((a: any) => {
          const exists = automations.some((existing: any) => existing.id === a.id);
          if (!exists) {
            automations.push(a);
            importedCount.automations++;
          }
        });
        saveAutomations(automations);
      }

      // Import memory
      if (exportData.memory && exportData.memory.facts) {
        let memory = { facts: [] as any[] };
        if (fs.existsSync(MEMORY_FILE)) {
          try { memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch (e) {}
        }
        exportData.memory.facts.forEach((f: any) => {
          const exists = memory.facts.some((existing: any) => existing.text === f.text);
          if (!exists) {
            memory.facts.push(f);
            importedCount.memory++;
          }
        });
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");
      }

      return res.json({ success: true, imported: importedCount });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}
