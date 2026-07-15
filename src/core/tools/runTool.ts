export interface ToolExecutionResult {
  toolId: string;
  toolName: string;
  success: boolean;
  input: any;
  result: any;
  output: any;
  error?: string;
  latencyMs: number;
}

/**
 * Executes a tool by ID on the backend with safety validation.
 */
export async function runTool(toolId: string, input: any, options?: { apiKey?: string }): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  if (!toolId || typeof toolId !== "string") {
    return {
      toolId: String(toolId),
      toolName: "Bilinmeyen Araç",
      success: false,
      input,
      result: null,
      output: null,
      error: "Geçersiz araç kimliği (toolId boş veya bir dize değil).",
      latencyMs: Date.now() - startTime
    };
  }

  // Client-side execution: call the server API
  if (typeof window !== "undefined") {
    try {
      let apiKey = options?.apiKey;
      if (!apiKey) {
        // Fallback to local storage if not explicitly passed
        try {
          const { getApiKeys } = await import("../../lib/encryption.js");
          const keysObj = getApiKeys();
          apiKey = keysObj["openai"] || keysObj["openrouter"] || keysObj["anthropic"] || keysObj["google"]; // Best effort fallback
        } catch(e) {
          console.warn("Failed to load secure API keys in runTool", e);
        }
      }

      const response = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, input, apiKey })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        toolId,
        toolName: toolId === "web_search_tool" ? "Web Arama Motoru" : "Bilişsel Düşünme Motoru",
        success: true,
        input,
        result: data.result,
        output: data.result,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        toolId,
        toolName: "Araç İsteği",
        success: false,
        input,
        result: null,
        output: null,
        error: `Sunucu iletişimi başarısız: ${err.message}`,
        latencyMs: Date.now() - startTime
      };
    }
  }

  // Server-side execution: use the registry directly
  // We use a dynamic import here to keep toolRegistry out of the client bundle
  try {
    const { getToolRegistry } = await import("./toolRegistry.js");
    const toolRegistry = await getToolRegistry();
    const tool = toolRegistry[toolId];

    if (!tool) {
      return {
        toolId,
        success: false,
        toolName: "Bilinmeyen Araç",
        input,
        result: null,
        output: null,
        error: `"${toolId}" kimliğine sahip bir araç sistem tescilinde bulunamadı.`,
        latencyMs: Date.now() - startTime
      };
    }

    const toolName = tool.id === "web_search_tool" ? "Web Arama Motoru" : "Bilişsel Düşünme Motoru";
    const result = await tool.run({ ...input, __apiKey: options?.apiKey });
    return {
      toolId,
      toolName,
      success: true,
      input,
      result,
      output: result,
      latencyMs: Date.now() - startTime
    };
  } catch (err: any) {
    return {
      toolId,
      toolName: "Sunucu Araç Çalıştırma",
      success: false,
      input,
      result: null,
      output: null,
      error: err.message || "Araç çalıştırılırken sunucu tarafında hata oluştu.",
      latencyMs: Date.now() - startTime
    };
  }
}
