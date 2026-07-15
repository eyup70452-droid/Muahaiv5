/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Users,
  Database,
  Wifi,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldAlert,
  Menu,
  Activity,
  Compass,
  Code,
  Brain
} from "lucide-react";

import { ProviderInfo, ModelInfo, ChatMessage, FileMetadata, CrewAgent, ChatSession, CustomProvider } from "./types";
import Sidebar from "./components/Sidebar";
import RightRail from "./components/RightRail";
import MainContent from "./components/MainContent";
import CommandBar from "./components/CommandBar";
import DiagnosticPanel from "./components/DiagnosticPanel";
import ProviderSettings from "./components/ProviderSettings";
import CustomModelSettings from "./components/CustomModelSettings";
import SystemLogPanel from "./components/SystemLogPanel";
import { CommandContext } from "./core/commands/commandRegistry";
import { parseAndExecuteSlashCommand } from "./core/commands/slashCommandParser";
import { runAgentTask } from "./core/agents/runAgentTask";
import { logger } from "./core/utils/systemLogger";
import { runSwarmTask } from "./core/swarm/runSwarmTask";
import { extractMemories } from "./core/memory/memoryExtractor";
import { routeModel } from "./core/agents/modelRouter";
import { getApiKeys, setApiKeys } from "./lib/encryption";
import { systemEvents } from "./core/utils/systemEvents";

export function parseThinkingTags(text: string): { content: string; reasoning: string } {
  let content = text;
  let reasoning = "";

  // Regex to match closed <think>...</think> tags
  const closedRegex = /<think>([\s\S]*?)<\/think>/g;
  let match;
  
  while ((match = closedRegex.exec(text)) !== null) {
    reasoning += (reasoning ? "\n\n" : "") + match[1].trim();
  }
  
  content = content.replace(closedRegex, "").trim();

  // Check if there is an unclosed <think> tag at the end (common during streaming)
  const openIndex = content.indexOf("<think>");
  if (openIndex !== -1) {
    const unfinishedReasoning = content.slice(openIndex + 7);
    reasoning += (reasoning ? "\n\n" : "") + unfinishedReasoning.trim();
    content = content.slice(0, openIndex).trim();
  }

  return { content, reasoning };
}

// Default prepopulated Providers
const DEFAULT_PROVIDERS: ProviderInfo[] = [
  { id: "openai", name: "OpenAI", logo: "[O]", apiKeyPlaceholder: "sk-...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" },
  { id: "anthropic", name: "Anthropic", logo: "[A]", apiKeyPlaceholder: "sk-ant-...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" },
  { id: "google", name: "Google Gemini", logo: "[G]", apiKeyPlaceholder: "AIzaSy...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" },
  { id: "deepseek", name: "DeepSeek", logo: "[D]", apiKeyPlaceholder: "sk-...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" },
  { id: "groq", name: "Groq", logo: "[Q]", apiKeyPlaceholder: "gsk_...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" },
  { id: "nvidia", name: "Nvidia NIM", logo: "[N]", apiKeyPlaceholder: "nvapi-...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" },
  { id: "openrouter", name: "OpenRouter", logo: "[R]", apiKeyPlaceholder: "sk-or-v1-...", hasKey: false, color: "border-gray-500 bg-gray-500/10 text-gray-400" }
];

export default function App() {
  type Panel = "chat" | "code" | "data" | "providers" | "media" | "memory";
  const [activePanel, setActivePanel] = useState<Panel>("chat");
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [hasSeenIntro, setHasSeenIntro] = useState(true);
  const [providers, setProviders] = useState<ProviderInfo[]>(DEFAULT_PROVIDERS);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [routingMode, setRoutingMode] = useState<"manuel" | "parallel" | "best_match">("best_match");
  const [systemInstruction, setSystemInstruction] = useState(
    "Siz, son derece gelişmiş, geliştirici sınıfı bir çoklu sağlayıcı sistemi olan MUAH AI'siniz."
  );

  // Responsive UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightRailOpen, setIsRightRailOpen] = useState(false);

  // Prevent mobile overlay conflict
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) {
      setIsRightRailOpen(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    if (isRightRailOpen && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [isRightRailOpen]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(() => {
    const savedCustom = localStorage.getItem("muah_ai_custom_providers");
    if (savedCustom) {
      try {
        return JSON.parse(savedCustom);
      } catch (e) {
        console.error("Failed to parse custom providers", e);
      }
    }
    return [];
  });

  // Core Active Session state
  const [session, setSession] = useState<ChatSession>({
    id: `session-${Date.now()}`,
    name: "Yeni Sohbet",
    messages: [],
    activeModelIds: [],
    fileIds: [],
    budgetLimit: 5.0,
    currentSpend: 0.0,
    createdAt: new Date().toISOString()
  });

  // Sessions list for persistence
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const savedSessions = localStorage.getItem("muah_ai_sessions");
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse sessions on init", e);
      }
    }
    return [];
  });

  // Local files state
  const [files, setFiles] = useState<FileMetadata[]>([]);

  // Token tracker
  const totalTokensUsed = session.messages.reduce((acc, msg) => {
    const tokens = typeof msg.tokens === 'object' ? msg.tokens?.total || 0 : (msg.tokens || 0);
    return acc + (tokens || Math.floor((msg.content?.length || 0) / 4) + Math.floor((msg.reasoning?.length || 0) / 4));
  }, 0);
  const [freeOnly, setFreeOnly] = useState(false);

  // Command Bar State
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAbortRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
  };

  // Global Keyboard listener for Command Palette (Cmd+K / Ctrl+K) and Quick Shortcuts (G C, G W, etc.)
  useEffect(() => {
    let keyBuffer = "";
    let bufferTimeout: NodeJS.Timeout;

    function handleKeyDown(e: KeyboardEvent) {
      // Toggle Command Bar with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
        return;
      }

      // Quick double-key shortcuts (Only when no input/textarea is focused)
      const isInputFocused = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (!isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        keyBuffer += e.key.toUpperCase();
        clearTimeout(bufferTimeout);

        // Map sequential characters
        if (keyBuffer === "GC" || keyBuffer === "G C") {
          setActivePanel("chat");
          keyBuffer = "";
        } else if (keyBuffer === "GW" || keyBuffer === "G W") {
          setActivePanel("code");
          keyBuffer = "";
        } else if (keyBuffer === "GD" || keyBuffer === "G D") {
          setActivePanel("data");
          keyBuffer = "";
        } else if (keyBuffer === "SC" || keyBuffer === "S C") {
          clearChat();
          keyBuffer = "";
        } else if (keyBuffer === "ST" || keyBuffer === "S T") {
          toggleTheme();
          keyBuffer = "";
        }

        bufferTimeout = setTimeout(() => {
          keyBuffer = "";
        }, 1000); // 1s window for sequential keys
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(bufferTimeout);
    };
  }, []);

  // Save sessions to localStorage when they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("muah_ai_sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("muah_ai_custom_providers", JSON.stringify(customProviders));
  }, [customProviders]);

  // Sync current session into the sessions list
  useEffect(() => {
    // Auto-name the session if it's new and has messages
    if (session.name === "Yeni Sohbet" && session.messages.length > 0) {
      const firstUserMsg = session.messages.find(m => m.role === "user");
      if (firstUserMsg) {
        const newName = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
        setSession(prev => ({ ...prev, name: newName }));
        return; // The next effect run will handle the sync
      }
    }

    setSessions(prev => {
      // Don't save empty default sessions unless they are explicitly created
      if (session.messages.length === 0 && session.name === "Yeni Sohbet" && prev.length > 0) {
        return prev;
      }
      
      const index = prev.findIndex(s => s.id === session.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = session;
        return updated;
      } else {
        return [session, ...prev];
      }
    });
    localStorage.setItem("muah_ai_last_active_id", session.id);
  }, [session]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      name: "Yeni Sohbet",
      messages: [],
      activeModelIds: [],
      fileIds: [],
      budgetLimit: 5.0,
      currentSpend: 0.0,
      createdAt: new Date().toISOString()
    };
    setSession(newSession);
    setActivePanel("chat");
  };

  const handleSwitchSession = (id: string) => {
    const target = sessions.find(s => s.id === id);
    if (target) {
      setSession(target);
      setFiles([]);
      setActivePanel("chat");
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        // Don't allow 0 sessions, create a new one
        const fresh: ChatSession = {
          id: `session-${Date.now()}`,
          name: "Yeni Sohbet",
          messages: [],
          activeModelIds: [],
          fileIds: [],
          budgetLimit: 5.0,
          currentSpend: 0.0,
          createdAt: new Date().toISOString()
        };
        setSession(fresh);
        return [fresh];
      }
      
      if (id === session.id) {
        setSession(filtered[0]);
      }
      return filtered;
    });
  };

  const clearChat = () => {
    setSession((prev) => ({
      ...prev,
      messages: []
    }));
  };

  const resetWorkspace = () => {
    setSession((prev) => ({
      ...prev,
      messages: [],
      currentSpend: 0.0
    }));
    setFiles([]);
    
  };

  const addSystemMessage = (content: string, toolCalls?: any[]) => {
    const sysMsg: ChatMessage = {
      id: `system-${Date.now()}`,
      role: "assistant",
      content,
      modelId: "system",
      timestamp: new Date().toLocaleTimeString(),
      toolCalls
    };
    setSession((prev) => ({
      ...prev,
      messages: [...prev.messages, sysMsg]
    }));
  };

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.toggle("light");
    addSystemMessage(isLight ? "[i] **Açık (Light) tema moduna geçildi.**" : "[i] **Karanlık (Dark) tema moduna geçildi.**");
  };

  const commandBarContext: CommandContext = {
    setActivePanel: (panel: string) => setActivePanel(panel as any),
    runTool: async (toolId: string, input: any) => {
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, input })
      });
      return await res.json();
    },
    clearChat,
    resetWorkspace,
    addSystemMessage,
    toggleTheme,
    sendMessage: (text, mode, customSys, aiMode) => {
      setActivePanel("chat");
      handleSendMessage(text, mode || "best_match", customSys || "", aiMode || "balanced");
    }
  };

  // Load Models on Mount
  useEffect(() => {
    async function loadModels() {
      try {
        const keysObj = getApiKeys();
        let allModels: ModelInfo[] = [];

        for (const [providerId, customApiKey] of Object.entries(keysObj)) {
          if (!customApiKey) continue;
          try {
            const res = await fetch("/api/validate-key", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ providerId, customApiKey })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.models && Array.isArray(data.models)) {
                const newModels = data.models.map((m: any) => ({
                  id: m.id,
                  provider: m.provider,
                  displayName: m.name,
                  category: ["text", "code"],
                  contextWindow: m.contextWindow || 128000,
                  maxOutputTokens: 4096, // Add default maxOutputTokens
                  pricing: m.pricing || { inputPer1M: 0, outputPer1M: 0, currency: "USD" },
                  isFree: m.isFree,
                  capabilities: {
                    functionCalling: true,
                    vision: true,
                    streaming: true,
                    jsonMode: true
                  },
                  status: "active",
                  health: {
                    consecutiveFailures: 0,
                    avgLatencyMs: 200,
                    successRate: 100
                  },
                  isNew: false
                }));
                allModels = [...allModels, ...newModels];
              }
            }
          } catch (e) {
            console.warn(`Failed to load models for ${providerId}`, e);
          }
        }
        
        // Also fetch default models if needed from /api/models
        try {
          const res = await fetch("/api/models");
          if (res.ok) {
            const defaultModels = await res.json();
            allModels = [...allModels, ...defaultModels.filter((dm: any) => !allModels.some((am: any) => am.id === dm.id))];
          }
        } catch(e) {}
        
        setModels(allModels);
      } catch (err) {
        console.warn("Could not fetch models:", err);
        setModels([]);
      }
    }
    loadModels();
  }, []);

  // Onboarding Escape handler
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setHasSeenIntro(true);
      }
    }
    if (!hasSeenIntro) {
      window.addEventListener("keydown", handleGlobalKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [hasSeenIntro]);

  // Sync API Keys with localStorage
  useEffect(() => {
    try {
      const keysObj = getApiKeys();
      if (Object.keys(keysObj).length > 0) {
        setProviders((prev) =>
          prev.map((p) => (keysObj[p.id] ? { ...p, hasKey: true } : p))
        );
      }
    } catch (e) {
      console.error("Failed to load credentials cache:", e);
    }
  }, []);

  // Update a single provider's API key
  const handleUpdateApiKey = (providerId: string, key: string) => {
    try {
      const keysObj = getApiKeys();
      if (key.trim()) {
        keysObj[providerId] = key;
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? { ...p, hasKey: true } : p))
        );
      } else {
        delete keysObj[providerId];
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? { ...p, hasKey: false } : p))
        );
      }
      setApiKeys(keysObj);
    } catch (e) {
      console.error(e);
    }
  };

  // Perform quick key verification check
  const handleValidateKey = async (providerId: string) => {
    addSystemMessage(`[~] **${providerId.toUpperCase()} API anahtarı doğrulanıyor...** Sağlayıcı ağına bağlanılıyor.`, [{
      toolId: "api_verify",
      toolName: "API Doğrulama Modülü",
      input: { provider: providerId },
      output: { status: "pending" },
      success: true,
      latencyMs: 150
    }]);

    try {
      const keysObj = getApiKeys();
      const customApiKey = keysObj[providerId];

      if (!customApiKey) {
        addSystemMessage(`[ERR] **${providerId.toUpperCase()} API Anahtarı Doğrulanamadı:** Anahtar boş olamaz.`);
        return;
      }

      const response = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, customApiKey })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Yanıt JSON değil: ${text.slice(0, 50)}...`);
      }
      
      if (data.success) {
        addSystemMessage(`[OK] **${providerId.toUpperCase()} API Anahtarı Doğrulandı:** Bağlantı başarılı. Modeller yerel çalışma alanına entegre edildi ve aktif olarak seçilebilir durumda.`);
        if (data.models && Array.isArray(data.models)) {
          const newModelIds = data.models.map((m: any) => m.id);
          setModels(prev => {
            const otherModels = prev.filter(m => m.provider !== providerId);
            const newModels = data.models.map((m: any) => ({
              id: m.id,
              provider: m.provider,
              displayName: m.name,
              category: ["text", "code"], // default categories
              contextWindow: m.contextWindow || 128000,
              pricing: m.pricing || { inputPer1M: 0, outputPer1M: 0 },
              isFree: m.isFree,
              isNew: false
            }));
            return [...otherModels, ...newModels];
          });
          setSession(prev => {
            const recommendedModelId = newModelIds.find(id => id.includes("gpt-4o") || id.includes("claude-3-5") || id.includes("gemini-2.0") || id.includes("gemini-2.5") || id.includes("llama-3.3") || id.includes("deepseek-chat")) || newModelIds[0];
            let nextActiveIds = Array.from(new Set([...prev.activeModelIds, recommendedModelId]));
            
            // If in manual mode and multiple models become active, keep only the most recent one to enforce single selection
            if (routingMode === "manuel" && nextActiveIds.length > 1) {
              nextActiveIds = [recommendedModelId];
            }
            
            return {
              ...prev,
              activeModelIds: nextActiveIds
            };
          });
        }
      } else {
        addSystemMessage(`[ERR] **${providerId.toUpperCase()} API Anahtarı Doğrulanamadı:** ${data.error || "Bilinmeyen bir hata oluştu."}`);
      }
    } catch (e: any) {
      addSystemMessage(`[ERR] **${providerId.toUpperCase()} API Anahtarı Doğrulanamadı:** Bağlantı hatası (${e.message}).`);
    }
  };

  // Toggle active models
  const handleToggleModel = (modelId: string) => {
    let warningTriggered = false;
    setSession((prev) => {
      const isCurrentlyActive = prev.activeModelIds.includes(modelId);
      let newActiveIds = [...prev.activeModelIds];

      if (routingMode === "manuel") {
        // Enforce exactly one active model in manual mode
        newActiveIds = [modelId];
      } else {
        if (isCurrentlyActive) {
          // Enforce at least one active model in parallel mode
          if (newActiveIds.length > 1) {
            newActiveIds = newActiveIds.filter((id) => id !== modelId);
          }
        } else {
          // Soft budget: Limit to 4 parallel comparison selections to avoid connection pool lockout
          if (newActiveIds.length < 4) {
            newActiveIds.push(modelId);
          } else {
            warningTriggered = true;
          }
        }
      }

      return { ...prev, activeModelIds: newActiveIds };
    });

    if (warningTriggered) {
      addSystemMessage("[WARN] İstek limiti sınırlamasını önlemek için maksimum 4 eşzamanlı karşılaştırma düğümüne izin verilir.");
    }
  };

  const handleSelectModel = (modelId: string) => {
    setSession((prev) => ({
      ...prev,
      activeModelIds: [modelId]
    }));
  };

  // Handle send message with Tool Orchestrator integration
  const handleSendMessage = async (
    text: string,
    mode: string,
    customSystemInstruction: string,
    aiMode: "fast" | "balanced" | "deep" | "agent" | "swarm" | "research" | "planner" = "balanced",
    isContinue: boolean = false,
    effortLevel: "low" | "medium" | "high" | "max" = "medium",
    behaviorMode: "normal" | "assistant" | "expert" | "architect" = "normal",
    selectedModelId?: string,
    deepThinkEnabled: boolean = false
  ) => {
    if (isSending) return;
    if ((!selectedModelId || selectedModelId === "") && session.activeModelIds.length === 0 && routingMode === "manuel") {
      addSystemMessage("[ERR] **Aktif Model Bulunamadı:** Manuel modda devam edebilmek için sol menüden en az bir modeli aktif etmelisiniz veya bir özel model seçmelisiniz.");
      return;
    }

    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const filesToSend = [...files];

    let textToProcess = text;
    if (!textToProcess.trim() && filesToSend.length > 0) {
      textToProcess = "Ekli dosyaları incele.";
    }

    if (isContinue) {
      // Find the last user message
      const lastUserMessage = [...session.messages].reverse().find(m => m.role === "user");
      textToProcess = lastUserMessage?.content || "Lütfen mesajı kaldığın yerden devam ettir.";
    } else {
      let displayContent = text;
      if (filesToSend.length > 0) {
        displayContent = (text.trim() ? text + "\n\n" : "") + filesToSend.map(f => `[+] **[Dosya: ${f.name}]**`).join("\n");
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: displayContent,
        timestamp: new Date().toLocaleTimeString()
      };

      // Update session state with user message immediately
      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg]
      }));
    }

    // Intercept and parse slash commands
    if (textToProcess.startsWith("/")) {
      try {
        const slashRes = await parseAndExecuteSlashCommand(text, {
          clearChat,
          addSystemMessage,
          files: filesToSend
        });

        if (slashRes.isSlashCommand) {
          if (slashRes.message) {
            setFiles([]);
            const sysMsg: ChatMessage = {
              id: `system-${Date.now()}`,
              role: "assistant",
              content: slashRes.message,
              reasoning: slashRes.reasoning,
              modelId: "system",
              timestamp: new Date().toLocaleTimeString(),
              toolCalls: slashRes.toolResult ? [slashRes.toolResult] : undefined
            };
            setSession((prev) => ({
              ...prev,
              messages: [...prev.messages, sysMsg]
            }));
          }
          setIsSending(false);
          return;
        }
      } catch (err: any) {
        addSystemMessage(`[ERR] Eğik çizgi komutu çalıştırılırken hata: ${err.message}`);
        setIsSending(false);
        return;
      } finally {
        setIsSending(false);
      }
    }

    // Basic Intent & Capability Check
    if (textToProcess.toLowerCase().includes("ara") || textToProcess.toLowerCase().includes("google") || textToProcess.toLowerCase().includes("web")) {
      const activeModels = session.activeModelIds.map(id => models.find(m => m.id === id)).filter(Boolean);
      const hasSearchTool = activeModels.some(m => m?.capabilities.functionCalling); // Assuming functionCalling implies search tool access for now
      
      if (!hasSearchTool) {
        addSystemMessage("[i] **İpucu:** Web arama veya güncel veri gerektiren bir istekte bulundunuz. Ancak seçili modellerin hiçbirinde bu özelliği etkinleştirecek araç (tool) erişimi görünmüyor. Daha iyi sonuçlar için 'function calling' veya 'web browsing' yeteneğine sahip bir model seçin veya bu özelliği aktif edebiliyorsanız aktif edin.");
      }
    }

    // === Custom Provider Intercept ===
    // Only intercept if a custom provider is active AND (no model selected OR selected model matches custom provider's modelId)
    const activeCustom = customProviders.find(p => p.isActive && (selectedModelId === p.modelId));
    
    if (activeCustom) {
      try {
        const apiHistory = session.messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }));

        const isLocalhost = activeCustom.baseUrl.includes('localhost') || activeCustom.baseUrl.includes('127.0.0.1');
        let response;

        const customModelId = selectedModelId || activeCustom.modelId;

        if (isLocalhost) {
          // Direct fetch from browser (Localhost bypass)
          response = await fetch(activeCustom.baseUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${activeCustom.apiKey || ""}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: customModelId,
              messages: [...apiHistory, { role: "user", content: textToProcess }],
              stream: false
            })
          });
        } else {
          // Proxy through server (CORS bypass)
          response = await fetch("/api/chat/custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              baseUrl: activeCustom.baseUrl,
              apiKey: activeCustom.apiKey,
              modelId: customModelId,
              messages: [...apiHistory, { role: "user", content: textToProcess }],
              stream: false
            })
          });
        }

        const responseText = await response.text();
        
        if (!response.ok) {
          let errMessage = `İstek başarısız (${response.status})`;
          try {
             const errData = JSON.parse(responseText);
             errMessage = errData.error || errMessage;
          } catch(e) {
             console.error("Response is not JSON:", responseText);
             if (responseText.trim().startsWith("<")) {
               errMessage = `Sunucudan HTML yanıtı alındı (${response.status}). URL hatalı olabilir. Yanıt özeti: ${responseText.slice(0, 100)}...`;
             } else {
               errMessage = `Sunucu hatası: ${response.statusText} (Yanıt JSON değil)`;
             }
          }
          throw new Error(errMessage);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch(e) {
            console.error("JSON Parse Error. Content:", responseText);
            const snippet = responseText.trim().slice(0, 100);
            throw new Error(`Sunucudan geçerli bir JSON yanıtı alınamadı. Yanıt özeti: ${snippet}...`);
        }
        
        const assistantMsgId = `msg-${Date.now()}-custom`;
        const content = data.choices?.[0]?.message?.content || "Yanıt alınamadı.";

        setSession(prev => ({
          ...prev,
          messages: [...prev.messages, {
            id: assistantMsgId,
            role: "assistant",
            content: content,
            timestamp: new Date().toLocaleTimeString(),
            modelId: customModelId,
            routingReason: `Özel Sağlayıcı: ${activeCustom.name}`
          }]
        }));
        
        setIsSending(false);
        setFiles([]);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setSession(prev => ({
          ...prev,
          messages: [...prev.messages, {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `[HATA] Özel sağlayıcı (${activeCustom.name}) isteği başarısız: ${err.message}`,
            timestamp: new Date().toLocaleTimeString(),
            error: err.message
          }]
        }));
        setIsSending(false);
        return;
      }
    }

    // Intercept and run as Multi-Agent Swarm
    if (aiMode === "swarm") {
      logger.info(`[Swarm] Görev başlatılıyor: "${textToProcess.substring(0, 50)}..."`, { goal: textToProcess });
      setFiles([]);
      const swarmMsgId = `msg-${Date.now()}-swarm`;
      const initialSwarmMsg: ChatMessage = {
        id: swarmMsgId,
        role: "assistant",
        content: "[SYS] **Multi-Agent Swarm Başlatılıyor...**\nEkip görevlendiriliyor, paralel araştırma ve kodlama süreçleri hazırlanıyor.",
        modelId: "swarm",
        timestamp: new Date().toLocaleTimeString(),
        agentTask: {
          id: `swarm-task-${Date.now()}`,
          goal: textToProcess,
          steps: [],
          status: "idle"
        }
      };

      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, initialSwarmMsg]
      }));

      try {
        await runSwarmTask(textToProcess, {
          onProgress: (progressTask) => {
            setSession((prevSession) => {
              const updatedMessages = prevSession.messages.map((msg) => {
                if (msg.id === swarmMsgId) {
                  const runningStep = progressTask.steps.find((s: any) => s.status === "running");
                  let content = `### [SYS] Swarm Ekibi Çalışıyor\n\n`;
                  if (progressTask.status === "running") {
                    content += `[*] **Durum:** Ajanlar paralel çalışıyor...\n`;
                    if (runningStep) {
                      content += `-> **Şu anki Adım:** *${runningStep.description}*\n`;
                    }
                  } else if (progressTask.status === "completed") {
                    logger.info("[Swarm] Görev başarıyla tamamlandı.");
                    content += `[OK] **Durum:** Swarm tüm görevleri tamamladı!\n\n`;
                    if (progressTask.result) {
                      content += progressTask.result.finalAnswer;
                    }
                  } else if (progressTask.status === "failed") {
                    logger.error("[Swarm] Görev başarısız oldu.");
                    content += `[ERR] **Durum:** Swarm başarısız oldu.\n`;
                  }

                  const mappedToolCalls = progressTask.steps
                    .filter((s: any) => s.status === "completed" || s.status === "failed")
                    .map((s: any) => ({
                      toolId: s.id,
                      toolName: s.toolId || s.id,
                      input: { status: s.status },
                      output: s.output || { description: s.description },
                      success: s.status === "completed",
                      latencyMs: 150
                    }));

                  return {
                    ...msg,
                    content,
                    agentTask: progressTask,
                    error: progressTask.status === "failed" ? "Swarm yürütme hatası" : undefined,
                    toolCalls: mappedToolCalls.length > 0 ? mappedToolCalls : undefined
                  };
                }
                return msg;
              });
              return {
                ...prevSession,
                messages: updatedMessages
              };
            });
          }
        });
      } catch (err: any) {
        let errMsg = err.message;
        if (errMsg && errMsg.includes('429')) {
          errMsg = "API kota sınırına ulaşıldı. Lütfen biraz bekleyip tekrar deneyiniz.";
        }
        setSession((prevSession) => {
          const updatedMessages = prevSession.messages.map((msg) => {
            if (msg.id === swarmMsgId) {
              return {
                ...msg,
                content: `[ERR] **Swarm yürütme sırasında hata oluştu:** ${errMsg}`,
                error: errMsg
              };
            }
            return msg;
          });
          return {
            ...prevSession,
            messages: updatedMessages
          };
        });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Intercept and run as Planner Agent
    if (aiMode === "planner") {
      logger.info(`[Planner] Görev planlaması başlatılıyor: "${textToProcess.substring(0, 50)}..."`);
      const plannerMsgId = `msg-${Date.now()}-planner`;
      const initialPlannerMsg: ChatMessage = {
        id: plannerMsgId,
        role: "assistant",
        content: "[SYS] **Bilişsel Planlayıcı Devreye Giriyor...**\nGörev karmaşıklığı analiz ediliyor ve yol haritası çıkarılıyor.",
        modelId: "planner",
        timestamp: new Date().toLocaleTimeString()
      };

      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, initialPlannerMsg]
      }));

      try {
        const { generateProjectPlan } = await import("./core/agents/planner");
        const plan = await generateProjectPlan(textToProcess);
        
        const planMarkdown = `### 📋 Stratejik Proje Planı\n\n**Hedef:** ${plan.goal}\n**Karmaşıklık Skoru:** ${plan.complexity}/10\n\n**Yol Haritası (Roadmap):**\n${plan.steps.map(s => `- [${s.status === 'completed' ? 'X' : ' '}] **${s.title}** (${s.estimatedEffort}): ${s.description}`).join("\n")}\n\n**Önerilen AI Ekibi:** ${plan.suggestedModels.join(", ")}`;

        setSession((prevSession) => {
          const updatedMessages = prevSession.messages.map((msg) => {
            if (msg.id === plannerMsgId) {
              return {
                ...msg,
                content: planMarkdown
              };
            }
            return msg;
          });
          return { ...prevSession, messages: updatedMessages };
        });
      } catch (err: any) {
        setSession((prevSession) => {
          const updatedMessages = prevSession.messages.map((msg) => {
            if (msg.id === plannerMsgId) {
              return { ...msg, content: `[ERR] Planlama hatası: ${err.message}`, error: err.message };
            }
            return msg;
          });
          return { ...prevSession, messages: updatedMessages };
        });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Intercept and run as Research Agent
    if (aiMode === "research") {
      logger.info(`[Research] Derin araştırma başlatılıyor: "${textToProcess.substring(0, 50)}..."`);
      const researchMsgId = `msg-${Date.now()}-research`;
      const initialResearchMsg: ChatMessage = {
        id: researchMsgId,
        role: "assistant",
        content: "[SYS] **Derin Araştırma Katmanı Başlatılıyor...**\nÇoklu kaynak taraması ve bilişsel sentez süreci hazırlanıyor.",
        modelId: "research",
        timestamp: new Date().toLocaleTimeString()
      };

      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, initialResearchMsg]
      }));

      try {
        const { runDeepResearch } = await import("./core/agents/researchAgent");
        const result = await runDeepResearch(textToProcess);
        
        setSession((prevSession) => {
          const updatedMessages = prevSession.messages.map((msg) => {
            if (msg.id === researchMsgId) {
              return {
                ...msg,
                content: `### [OK] Derin Araştırma Tamamlandı\n\n**Sorgu:** ${result.query}\n\n**Bulgular:**\n${result.findings.join("\n")}\n\n**Özet:**\n${result.summary}\n\n**Kaynaklar:** ${result.sources.join(", ")}`
              };
            }
            return msg;
          });
          return { ...prevSession, messages: updatedMessages };
        });
      } catch (err: any) {
        setSession((prevSession) => {
          const updatedMessages = prevSession.messages.map((msg) => {
            if (msg.id === researchMsgId) {
              return { ...msg, content: `[ERR] Araştırma hatası: ${err.message}`, error: err.message };
            }
            return msg;
          });
          return { ...prevSession, messages: updatedMessages };
        });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Intercept and run as Autonomous AI Agent
    if (aiMode === "agent") {
      logger.info(`[Agent] Otonom ajan başlatılıyor: "${textToProcess.substring(0, 50)}..."`);
      setFiles([]);
      const agentMsgId = `msg-${Date.now()}-agent`;
      const initialAgentMsg: ChatMessage = {
        id: agentMsgId,
        role: "assistant",
        content: "[SYS] **Otonom Ajan Başlatılıyor...**\nHedefiniz doğrultusunda en uygun eylem planı hazırlanıyor.",
        modelId: "agent",
        timestamp: new Date().toLocaleTimeString(),
        agentTask: {
          id: `task-${Date.now()}`,
          goal: textToProcess,
          steps: [],
          status: "idle"
        }
      };

      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, initialAgentMsg]
      }));

      try {
        // Use selected model if available, otherwise fallback
        const activeModelId = session.activeModelIds[0] || "gpt-4o";
        const activeModelInfo = models.find((m) => m.id === activeModelId) || models[0];
        let customApiKey = "";
        try {
          const keysObj = getApiKeys();
          customApiKey = keysObj[activeModelInfo.provider] || "";
        } catch (e) {
          console.error("Error reading credentials cache in agent:", e);
        }

        await runAgentTask(textToProcess, {
          files: filesToSend,
          modelId: activeModelId,
          providerId: activeModelInfo?.provider,
          customApiKey,
          onProgress: (progressTask) => {
            setSession((prevSession) => {
              const updatedMessages = prevSession.messages.map((msg) => {
                if (msg.id === agentMsgId) {
                  const runningStep = progressTask.steps.find((s) => s.status === "running");
                  let content = `### [SYS] Otonom Ajan Çalışıyor\n\n`;
                  if (progressTask.status === "running") {
                    content += `[*] **Durum:** Adımlar sırayla yürütülüyor...\n`;
                    if (runningStep) {
                      content += `-> **Şu anki Adım:** *${runningStep.description}*\n`;
                    }
                  } else if (progressTask.status === "completed") {
                    content += `[OK] **Durum:** Tüm adımlar başarıyla tamamlandı!\n\n`;
                    if (progressTask.result) {
                      content += progressTask.result.finalAnswer;
                    }
                  } else if (progressTask.status === "failed") {
                    content += `[ERR] **Durum:** Ajan çalışması başarısız oldu.\n`;
                  }

                  const mappedToolCalls = progressTask.steps
                    .filter((s) => s.status === "completed" || s.status === "failed")
                    .map((s) => ({
                      toolId: s.id,
                      toolName: s.toolId,
                      input: s.input,
                      output: s.output || null,
                      success: s.status === "completed",
                      latencyMs: 150
                    }));

                  return {
                    ...msg,
                    content,
                    agentTask: progressTask,
                    error: progressTask.status === "failed" ? "Ajan yürütme hatası" : undefined,
                    toolCalls: mappedToolCalls.length > 0 ? mappedToolCalls : undefined
                  };
                }
                return msg;
              });
              return {
                ...prevSession,
                messages: updatedMessages
              };
            });
          }
        });
      } catch (err: any) {
        let errMsg = err.message;
        if (errMsg && errMsg.includes('429')) {
          errMsg = "API kota sınırına ulaşıldı. Lütfen biraz bekleyip tekrar deneyiniz.";
        }
        setSession((prevSession) => {
          const updatedMessages = prevSession.messages.map((msg) => {
            if (msg.id === agentMsgId) {
              return {
                ...msg,
                content: `[ERR] **Ajan yürütme sırasında hata oluştu:** ${errMsg}`,
                error: errMsg
              };
            }
            return msg;
          });
          return {
            ...prevSession,
            messages: updatedMessages
          };
        });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Real Backend-Driven Tool Execution Orchestrator
    const apiHistory = session.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const toolCallsExecuted: {
      toolId: string;
      toolName: string;
      input: any;
      output: any;
      success: boolean;
      latencyMs: number;
    }[] = [];

    let prependedContext = "";
    const textLower = text.toLowerCase();

    // Determine if web search should be provided as a tool (only if requested in system instruction)
    const isWebSearchAllowed = customSystemInstruction.includes("[WEB_SEARCH_REQUIRED]");
    const cleanedInstructions = customSystemInstruction.replace("[WEB_SEARCH_REQUIRED]", "");
    
    // Inject Bilişsel Bellek (Memory) into system instruction
    const { memoryStore } = await import("./core/memory/memoryStore");
    const memoryContext = memoryStore.getContextString();
    const finalSystemInstruction = `${cleanedInstructions}${memoryContext}`;

    const startThinkTime = Date.now();
    try {
      let finalActiveModelId = session.activeModelIds[0] || "gpt-4o";
      let routingReason = "";
      
      const keysObj = getApiKeys();
      const hasKeys = Object.entries(keysObj).filter(([_, v]) => !!v).map(([k, _]) => k);

      let modelQueue: string[] = [finalActiveModelId];
      
    if (routingMode === "best_match") {
        logger.info(`[Routing] En iyi model aranıyor: "${text.substring(0, 30)}..."`);
        const routingResult = routeModel(text, models, { freeOnly, hasKeys });
        
        if (routingResult) {
          finalActiveModelId = routingResult.selectedModel.id;
          routingReason = routingResult.reason;
          logger.info(`[Routing] Seçilen model: ${finalActiveModelId} (${routingReason})`);
          
          // CRITICAL BUG FIX: Check if API key is missing for the selected best match model
          const providerId = routingResult.selectedModel.provider;
          const isKeyMissing = !hasKeys.includes(providerId);
          
          if (isKeyMissing) {
            // Find a fallback model that DOES have an active API key
            const fallbackWithKey = models.find(m => m.status !== "inactive" && hasKeys.includes(m.provider));
            if (fallbackWithKey) {
              finalActiveModelId = fallbackWithKey.id;
              routingReason = `En iyi eşleşen model ${routingResult.selectedModel.displayName} idi, ancak ${providerId.toUpperCase()} API anahtarınız eksik olduğu için aktif anahtara sahip ${fallbackWithKey.displayName} modeline otomatik yönlendirme yapıldı.`;
              modelQueue = [finalActiveModelId];
            } else {
              // No API keys configured anywhere! Prompt user with clean UI messages.
              setSession((prev) => ({
                ...prev,
                messages: [...prev.messages, {
                  id: `system-${Date.now()}`,
                  role: "assistant",
                  content: `[WARN] **API Anahtarı Yapılandırılmamış:** Bu görev için en iyi model **${routingResult.selectedModel.displayName}** olarak seçildi, ancak **${providerId.toUpperCase()}** için API anahtarınız girilmemiş.\n\nSohbet edebilmek için lütfen sol menüdeki **Model Sağlayıcıları** sekmesinden ilgili sağlayıcı için API anahtarınızı girin veya ücretsiz modellerle devam etmek için **Sadece Ücretsiz** seçeneğini işaretleyin.`,
                  modelId: "system",
                  timestamp: new Date().toLocaleTimeString()
                }]
              }));
              setIsSending(false);
              return;
            }
          } else {
            modelQueue = [finalActiveModelId, ...routingResult.fallbackModels.map(m => m.id)];
          }
        } else if (freeOnly) {
          // If no free models available, inform user
          setSession((prev) => ({
            ...prev,
            messages: [...prev.messages, {
              id: `system-${Date.now()}`,
              role: "assistant",
              content: "[ERR] **Bu görev için uygun ücretsiz model bulunamadı.** Lütfen bütçe dostu modu kapatın veya farklı bir sağlayıcı yapılandırın.",
              modelId: "system",
              timestamp: new Date().toLocaleTimeString()
            }]
          }));
          setIsSending(false);
          return;
        }
        
        handleSelectModel(finalActiveModelId);
      }

      let success = false;
      let lastError = "";

      if (routingMode === "parallel") {
        // Parallel model comparison mode! Run requests to all active models concurrently.
        let activeModelIds = session.activeModelIds.filter(id => id !== "system");
        
        if (activeModelIds.length <= 1) {
          // If the user hasn't selected multiple comparison nodes yet, automatically pick the best models with keys (or popular defaults)
          const modelsWithKeys = models.filter(m => m.status !== "inactive" && hasKeys.includes(m.provider));
          if (modelsWithKeys.length >= 2) {
            activeModelIds = modelsWithKeys.slice(0, 4).map(m => m.id);
          } else {
            // Pick top popular accessible models
            const popularDefaults = ["gpt-4o-mini", "claude-3-5-haiku", "deepseek-v3", "gemini-2.5-flash"];
            const availablePopular = models.filter(m => popularDefaults.includes(m.id) && m.status !== "inactive");
            if (availablePopular.length >= 2) {
              activeModelIds = availablePopular.map(m => m.id);
            } else {
              activeModelIds = models.slice(0, 3).map(m => m.id);
            }
          }
          
          // Sync with state so the UI registers the active comparison nodes
          setSession(prev => ({ ...prev, activeModelIds }));
        }
        
        const parallelPromises = activeModelIds.map(async (modelId) => {
          const activeModelInfo = models.find((m) => m.id === modelId) || models[0];
          const providerId = activeModelInfo?.provider || "openai";
          let customApiKey = keysObj[providerId] || "";

          try {
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                messages: [...apiHistory, { role: "user", content: text.trim() || "Ekli dosyaları incele." }],
                modelId: modelId,
                providerId: providerId,
                customApiKey,
                routingMode,
                aiMode,
                effortLevel,
                behaviorMode,
                webSearchEnabled: isWebSearchAllowed,
                systemInstruction: finalSystemInstruction || "",
                deepThinkEnabled,
                attachedFiles: filesToSend.map(f => ({
                  name: f.name,
                  content: f.content
                }))
              })
            });

            if (!response.ok) {
              const contentType = response.headers.get("Content-Type");
              if (contentType && contentType.includes("application/json")) {
                const errData = await response.json();
                throw new Error(errData.error || `İstek başarısız (${response.status})`);
              } else {
                const text = await response.text();
                console.error("Non-JSON Error Response:", text);
                throw new Error(`Sunucu hatası (${response.status})`);
              }
            }

            if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
              setFiles([]);
              const reader = response.body?.getReader();
              const decoder = new TextDecoder();
              const assistantMsgId = `msg-${Date.now()}-${modelId}`;

              // Add initial empty message for this model
              setSession((prev) => ({
                ...prev,
                messages: [...prev.messages, {
                  id: assistantMsgId,
                  role: "assistant",
                  content: "",
                  timestamp: new Date().toLocaleTimeString(),
                  modelId: modelId,
                  routingReason: "Paralel Karşılaştırma"
                }]
              }));

              let fullContent = "";
              let currentThinking = "";
              let buffer = "";

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });
                  buffer += chunk;
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    if (line.startsWith("data: ")) {
                      const dataStr = line.slice(6);
                      if (dataStr === "[DONE]") break;

                      try {
                        const data = JSON.parse(dataStr);

                        if (data.type === "content") {
                          fullContent += data.content;
                          setSession((prev) => ({
                            ...prev,
                            messages: prev.messages.map(m =>
                              m.id === assistantMsgId ? { ...m, content: fullContent } : m
                            )
                          }));
                        } else if (data.type === "reasoning") {
                          currentThinking += data.content;
                          setSession((prev) => ({
                            ...prev,
                            messages: prev.messages.map(m =>
                              m.id === assistantMsgId ? { ...m, reasoning: currentThinking } : m
                            )
                          }));
                        } else if (data.type === "notification") {
                          systemEvents.emit("system", data.message);
                        } else if (data.type === "tool_start") {
                          const { tool } = data;
                          logger.info(`[Tool] Araç başlatıldı: ${tool.toolName}`, tool.input);
                          setSession((prev) => ({
                            ...prev,
                            messages: prev.messages.map(m =>
                              m.id === assistantMsgId ? { 
                                ...m, 
                                toolCalls: [...(m.toolCalls || []), tool] 
                              } : m
                            )
                          }));
                        } else if (data.type === "tool_end") {
                          const { tool } = data;
                          logger.info(`[Tool] Araç tamamlandı: ${tool.toolName}`, { success: tool.success });
                          setSession((prev) => ({
                            ...prev,
                            messages: prev.messages.map(m =>
                              m.id === assistantMsgId ? { 
                                ...m, 
                                toolCalls: (m.toolCalls || []).map(tc => tc.toolId === tool.toolId ? tool : tc)
                              } : m
                            )
                          }));
                        } else if (data.type === "done") {
                          const metadata = data.metadata;
                          setSession((prev) => ({
                            ...prev,
                            messages: prev.messages.map(m =>
                              m.id === assistantMsgId ? {
                                ...m,
                                ...metadata,
                                content: fullContent
                              } : m
                            )
                          }));
                        }
                      } catch (e) {}
                    }
                  }
                }
              }
            } else if (response.ok) {
              const text = await response.text();
              const chatData = JSON.parse(text);
              const assistantMsgId = `msg-${Date.now()}-${modelId}`;

              setSession((prev) => ({
                ...prev,
                messages: [...prev.messages, {
                  id: assistantMsgId,
                  role: "assistant",
                  content: chatData.content || "Hata: Yanıt üretilemedi.",
                  reasoning: chatData.reasoning || "",
                  timestamp: new Date().toLocaleTimeString(),
                  modelId: modelId,
                  routingReason: "Paralel Karşılaştırma",
                  appliedParams: chatData.appliedParams,
                  latencyMs: chatData.latencyMs,
                  tokens: chatData.tokens,
                  cost: chatData.cost
                }]
              }));
            } else {
              const textOutput = await response.text();
              throw new Error(`Sıra dışı sunucu yanıtı (${response.status}): ${textOutput.slice(0, 100)}`);
            }
          } catch (modelErr: any) {
            console.error(`Parallel model execution failed for ${modelId}:`, modelErr);
            const assistantMsgId = `msg-${Date.now()}-${modelId}`;
            setSession((prev) => ({
              ...prev,
              messages: [...prev.messages, {
                id: assistantMsgId,
                role: "assistant",
                content: `[ERR] Model Karşılaştırma Hatası: ${modelErr.message}`,
                modelId: modelId,
                timestamp: new Date().toLocaleTimeString(),
                error: modelErr.message
              }]
            }));
          }
        });

        await Promise.all(parallelPromises);
        success = true;
      } else {
        // Standard single model or best_match sequential flow
        for (const currentModelId of modelQueue) {
        try {
          const activeModelInfo = models.find((m) => m.id === currentModelId) || models[0];
          const providerId = activeModelInfo?.provider || "openai";
          let customApiKey = keysObj[providerId] || "";

          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              messages: [...apiHistory, { role: "user", content: text.trim() || "Ekli dosyaları incele." }],
              modelId: currentModelId,
              providerId: providerId,
              customApiKey,
              routingMode,
              aiMode,
              effortLevel,
              behaviorMode,
              webSearchEnabled: isWebSearchAllowed,
              systemInstruction: finalSystemInstruction || "",
              deepThinkEnabled,
              attachedFiles: filesToSend.map(f => ({
                name: f.name,
                content: f.content
              }))
            })
          });

          if (response.ok && response.headers.get("Content-Type")?.includes("text/event-stream")) {
            setFiles([]);
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMsgId = `msg-${Date.now()}-assistant`;
            
            // Add initial empty message
            setSession((prev) => ({
              ...prev,
              messages: [...prev.messages, {
                id: assistantMsgId,
                role: "assistant",
                content: "",
                timestamp: new Date().toLocaleTimeString(),
                modelId: currentModelId,
                routingReason: currentModelId !== finalActiveModelId ? `Yedek Model: ${routingReason}` : routingReason
              }]
            }));

            let fullContent = "";
            let currentThinking = "";
            let toolCalls: any[] = [];
            let buffer = "";

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const dataStr = line.slice(6);
                    if (dataStr === "[DONE]") break;
                    
                    try {
                      const data = JSON.parse(dataStr);
                      
                      if (data.type === "content") {
                        fullContent += data.content;
                        const parsed = parseThinkingTags(fullContent);
                        setSession((prev) => ({
                          ...prev,
                          messages: prev.messages.map(m => 
                            m.id === assistantMsgId ? { 
                              ...m, 
                              content: parsed.content,
                              reasoning: currentThinking ? (currentThinking + (parsed.reasoning ? "\n\n" + parsed.reasoning : "")) : parsed.reasoning
                            } : m
                          )
                        }));
                      } else if (data.type === "reasoning") {
                        currentThinking += data.content;
                        const parsed = parseThinkingTags(fullContent);
                        setSession((prev) => ({
                          ...prev,
                          messages: prev.messages.map(m => 
                            m.id === assistantMsgId ? { 
                              ...m, 
                              reasoning: currentThinking + (parsed.reasoning ? "\n\n" + parsed.reasoning : "")
                            } : m
                          )
                        }));
                      } else if (data.type === "tool_start") {
                        toolCalls.push(data.tool);
                        setSession((prev) => ({
                          ...prev,
                          messages: prev.messages.map(m => 
                            m.id === assistantMsgId ? { ...m, toolCalls: [...toolCalls] } : m
                          )
                        }));
                      } else if (data.type === "tool_end") {
                        const idx = toolCalls.findIndex(t => t.toolId === data.tool.toolId);
                        if (idx !== -1) toolCalls[idx] = data.tool;
                        setSession((prev) => ({
                          ...prev,
                          messages: prev.messages.map(m => 
                            m.id === assistantMsgId ? { ...m, toolCalls: [...toolCalls] } : m
                          )
                        }));
                      } else if (data.type === "done") {
                        const metadata = data.metadata;
                        const finalContentToParse = metadata?.content || fullContent;
                        const parsed = parseThinkingTags(finalContentToParse);
                        setSession((prev) => ({
                          ...prev,
                          messages: prev.messages.map(m => 
                            m.id === assistantMsgId ? { 
                              ...m, 
                              ...metadata,
                              content: parsed.content,
                              reasoning: currentThinking ? (currentThinking + (parsed.reasoning ? "\n\n" + parsed.reasoning : "")) : parsed.reasoning
                            } : m
                          )
                        }));

                        // Background Memory Extraction
                        const keysObj = getApiKeys();
                        const apiKey = keysObj["openai"] || keysObj["anthropic"] || keysObj["google"] || "";
                        fetch("/api/memory/extract", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ messages: [...apiHistory, { role: "user", content: text }, { role: "assistant", content: finalContentToParse }], apiKey })
                        }).catch(e => console.error("Memory extract error:", e));
                      } else if (data.type === "error") {
                        throw new Error(data.message);
                      }
                    } catch (e) {
                      console.error("Error parsing stream chunk:", e, line);
                    }
                  }
                }
              }
            }
            success = true;
            break;
          } else {
            // Non-streaming or Error
            const textOutput = await response.text();
            
            if (response.ok) {
              let chatData;
              try {
                  chatData = JSON.parse(textOutput);
              } catch(e) {
                  if (textOutput.trim().startsWith("<")) {
                      throw new Error("Sunucudan HTML yanıtı alındı (URL hatalı olabilir veya API uç noktası değil).");
                  }
                  throw new Error("Sunucudan geçerli bir JSON yanıtı alınamadı.");
              }
              
              let rawContent = chatData.content || "Üzgünüm, yanıt üretilemedi.";
              let finalReasoning = chatData.reasoning || "";
              
              const parsed = parseThinkingTags(rawContent);
              let finalContent = parsed.content;
              if (parsed.reasoning) {
                finalReasoning = finalReasoning ? finalReasoning + "\n\n" + parsed.reasoning : parsed.reasoning;
              }
              
              const assistantMsg: ChatMessage = {
                id: `msg-${Date.now()}-assistant`,
                role: "assistant",
                content: finalContent,
                reasoning: finalReasoning,
                toolCalls: chatData.toolCalls?.length > 0 ? chatData.toolCalls : undefined,
                appliedParams: chatData.appliedParams,
                timestamp: new Date().toLocaleTimeString(),
                modelId: chatData.modelId || currentModelId,
                routingReason: currentModelId !== finalActiveModelId 
                  ? `Yedek Model: ${routingReason}` 
                  : routingReason,
                latencyMs: chatData.latencyMs,
                tokens: chatData.tokens,
                cost: chatData.cost
              };

              setSession((prev) => ({
                ...prev,
                messages: [...prev.messages, assistantMsg]
              }));

              // Background Memory Extraction
              const keysObj = getApiKeys();
              const apiKey = keysObj["openai"] || keysObj["anthropic"] || keysObj["google"] || "";
              fetch("/api/memory/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: [...apiHistory, { role: "user", content: text }, { role: "assistant", content: finalContent }], apiKey })
              }).catch(e => console.error("Memory extract error:", e));

              success = true;
              break;
            } else {
              let errData: any = {};
              try {
                errData = JSON.parse(textOutput);
              } catch (e) {
                errData = { error: `Sunucu Hatası (${response.status}): ${textOutput.slice(0, 100)}...` };
              }
              lastError = errData.error || `Sunucu ${response.status} hatası döndürdü.`;
              console.warn(`Model ${currentModelId} failed: ${lastError}. Trying next in queue...`);
            }
          }
        } catch (e: any) {
          lastError = e.message;
          console.warn(`Model ${currentModelId} exception: ${lastError}. Trying next in queue...`);
        }
      }
      }

      if (!success) {
        throw new Error(lastError || "Tüm model kuyruğu başarısız oldu.");
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error("Chat API call failed:", err);
      let errMsg = err.message;
      if (errMsg && errMsg.includes('429')) {
        errMsg = "API kota sınırına ulaşıldı. Lütfen biraz bekleyip tekrar deneyiniz.";
      }
      
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `[ERR] **Yürütme Hatası:** ${errMsg}`,
        timestamp: new Date().toLocaleTimeString(),
        modelId: "system",
        error: errMsg,
        toolCalls: toolCallsExecuted.length > 0 ? toolCallsExecuted : undefined
      };
      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMsg]
      }));
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
      
      // Auto-extract memories after exchange
      if (session.messages.length > 0) {
        setTimeout(() => {
          extractMemories(session.messages).catch(console.error);
        }, 1000);
      }
    }
  };

  // Process file upload
  const handleUploadFile = async (name: string, size: number, content: string) => {
    try {
      const res = await fetch("/api/files/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name, fileSize: size, fileContent: content })
      });
      if (res.ok) {
        const data: FileMetadata = await res.json();
        setFiles((prev) => [...prev, data]);
      } else {
        throw new Error("Could not register file chunk with parse server.");
      }
    } catch (err: any) {
      console.error(err);
      setSession((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `system-file-error-${Date.now()}`,
            role: "system",
            content: `[ERR] ${name} yükleme hatası: ${err.message || err}`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]
      }));
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Query file contents contextually
  const handleQueryFileContent = async (query: string, fileContents: string) => {
    // We send a request to /api/chat using active model to synthesize the query answer
    const searchPrompt = `
      Here is the contents of our indexed codebase file:
      -----------------------------------------
      ${fileContents}
      -----------------------------------------
      
      User wants to know: "${query}".
      Please respond as a Senior Developer giving a crisp, direct, highly factual answer based ONLY on the source file above. If relevant, include exact snippets.
    `;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: "meta/llama-3.1-405b-instruct",
          providerId: "nvidia",
          messages: [{ role: "user", content: searchPrompt }],
          systemInstruction: "You are a highly precise file query indexing compiler."
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.content;
      } else {
        throw new Error("Failed to compile query result on backend.");
      }
    } catch (err: any) {
      return `Error summarizing file: ${err.message}`;
    }
  };

  // Strategic Deep Research handler (B.4)
  const handleDeepResearch = async (topic: string) => {
    try {
      const res = await fetch("/api/research/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Image Generation handler (G.1)
  const handleGenerateImage = async (prompt: string) => {
    try {
      const keysObj = getApiKeys();
      const apiKey = keysObj["openai"] || keysObj["anthropic"] || keysObj["google"] || "";
      const res = await fetch("/api/media/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Text-to-Speech handler (G.2)
  const handleSynthesizeSpeech = async (text: string) => {
    try {
      const keysObj = getApiKeys();
      const apiKey = keysObj["openai"] || keysObj["anthropic"] || keysObj["google"] || "";
      const res = await fetch("/api/media/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, apiKey })
      });
      const data = await res.json();
      if (data && data.success) {
        return data;
      } else {
        throw new Error((data && data.error) || "Sunucu ses sentezleme başarısız oldu.");
      }
    } catch (err: any) {
      console.warn("[TTS Fallback] Yerel tarayıcı ses sentezleme başlatılıyor:", err.message);
      
      // Native Web Speech API fallback
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "tr-TR";
          
          // Try to select a Turkish voice if available
          const voices = window.speechSynthesis.getVoices();
          const trVoice = voices.find(v => v.lang.includes("tr"));
          if (trVoice) {
            utterance.voice = trVoice;
          }
          
          window.speechSynthesis.speak(utterance);
          const mockWave = Array.from({ length: 40 }, () => Math.round(15 + Math.random() * 80));
          return { 
            success: true, 
            url: "local-speech-synthesis", 
            waveData: mockWave,
            note: "Yerel tarayıcı ses sentezleyicisi kullanılıyor."
          };
        } catch (synthErr: any) {
          return { success: false, error: `Yerel sentezleme de başarısız: ${synthErr.message}` };
        }
      }
      return { success: false, error: err.message };
    }
  };

  return (
    <div className="w-screen h-screen bg-[#09090d] text-gray-200 flex flex-col overflow-hidden font-sans select-none" id="app-root-container">
      {/* Top Application Bar */}
      <div className="h-14 border-b border-[#1f1f26] px-4 md:px-5 flex items-center justify-between bg-[#0c0c10]/40 shrink-0" id="app-navbar">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar max-w-[85%] sm:max-w-none">
          {/* Mobile Sidebar Toggle Button */}
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="lg:hidden p-2 bg-[#16161f] rounded-xl border border-[#1f1f26] text-gray-400 hover:text-white transition-colors"
            title="Sağlayıcı Menüsünü Aç"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Right Info and Drawer trigger */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setHasSeenIntro(false)}
            className="hidden md:flex items-center gap-1.5 text-[10px] uppercase text-gray-400 hover:text-rose-400 font-mono tracking-wider font-semibold transition-colors"
            title="Sistem Rehberini Göster"
          >
            [ REHBER ]
          </button>

          {/* Mount point for Model Selector Dropdown from ChatHub */}
          <div id="topbar-settings-anchor" className="relative shrink-0 z-50"></div>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Control Column */}
        <Sidebar
          activePanel={activePanel}
          setActivePanel={(panel) => setActivePanel(panel as Panel)}
          providers={providers}
          models={models}
          activeModelIds={session.activeModelIds}
          onToggleModel={handleToggleModel}
          onUpdateApiKey={handleUpdateApiKey}
          onValidateKey={handleValidateKey}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          sessions={sessions}
          activeSessionId={session.id}
          onNewChat={handleNewChat}
          onSwitchSession={handleSwitchSession}
          onDeleteSession={handleDeleteSession}
          onOpenCustomSettings={() => setIsCustomSettingsOpen(true)}
          onOpenLogs={() => setIsLogsOpen(true)}
        />

        {/* Core Screen Router */}
        <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#111114]">
          {activePanel === "providers" ? (
            <ProviderSettings
              providers={providers}
              models={models}
              activeModelIds={session.activeModelIds}
              onToggleModel={handleToggleModel}
              onUpdateApiKey={handleUpdateApiKey}
              onValidateKey={handleValidateKey}
              freeOnly={freeOnly}
              setFreeOnly={setFreeOnly}
            />
          ) : (
            <MainContent
              activePanel={activePanel}
              session={session}
              models={models}
              providers={providers}
              isSending={isSending}
              routingMode={routingMode}
              onChangeRoutingMode={setRoutingMode}
              systemInstruction={systemInstruction}
              onUpdateSystemInstruction={setSystemInstruction}
              files={files}
              onUploadFile={handleUploadFile}
              onRemoveFile={handleRemoveFile}
              onQueryFileContent={handleQueryFileContent}
              onDeepResearch={handleDeepResearch}
              onGenerateImage={handleGenerateImage}
              onSynthesizeSpeech={handleSynthesizeSpeech}
              onSendMessage={handleSendMessage}
              onAbort={handleAbortRequest}
              onSelectModel={handleSelectModel}
              onNewChat={handleNewChat}
              onClearHistory={clearChat}
              onToggleHistory={() => setIsRightRailOpen(true)}
              onToggleDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
              customProviders={customProviders}
              onActivateCustomProvider={(id) => {
                const updated = customProviders.map(p => ({ ...p, isActive: p.id === id }));
                setCustomProviders(updated);
              }}
            />
          )}
        </div>

        {/* Right Telemetry Column */}
        <RightRail
          session={session}
          sessions={sessions}
          models={models}
          totalTokensUsed={totalTokensUsed}
          isOpen={isRightRailOpen}
          onClose={() => setIsRightRailOpen(false)}
          onSwitchSession={handleSwitchSession}
          onDeleteSession={handleDeleteSession}
        />

        {activePanel === "chat" && showDiagnostics && (
          <div className="w-80 h-full shrink-0 hidden lg:block border-l border-zinc-900/40">
            <DiagnosticPanel />
          </div>
        )}
      </div>

      {/* Onboarding Modal */}
      {!hasSeenIntro && (
        <div className="fixed inset-0 bg-[#060608]/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111116] border border-[#2b2b36]  max-w-lg w-full p-6 sm:p-8 relative animate-fade-in text-gray-200">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setHasSeenIntro(true)}
                className="text-gray-600 hover:text-gray-300 transition text-[10px] uppercase tracking-widest font-mono"
              >
                [ KAPAT ]
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-100 tracking-widest uppercase">Sistem Rehberi</h2>
                <p className="text-xs text-gray-500 font-mono">Geliştirici Sınıfı Yönlendirme Konsolu</p>
              </div>

              <div className="space-y-6 pt-2">
                <div className="space-y-2">
                  <h3 className="text-gray-300 font-mono text-xs uppercase tracking-wide">01. Akıllı Yönlendirme</h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">
                    Model seçmek zorunda değilsiniz. Sistem, yazdığınız mesajın karmaşıklığına ve konusuna göre en doğru modeli otomatik olarak seçip yönlendirir.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-gray-300 font-mono text-xs uppercase tracking-wide">02. Muhakeme Derinliği</h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">
                    Modelin yanıt üretirken harcayacağı eforu ayarlayabilirsiniz. Max seviye derin multi-agent akıl yürütme süreçlerini tetikler.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-4">
                <button
                  onClick={() => setHasSeenIntro(true)}
                  className="w-full h-10 bg-gray-100 hover:bg-white text-[#111116] font-semibold text-xs tracking-widest uppercase transition-colors"
                >
                  Sistemi Başlat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* İlk Açılış Hoş Geldiniz Modalı (Onboarding) */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-[#060608]/95 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 overflow-y-auto" id="welcome-onboarding-modal">
          <div className="bg-[#111116] border border-[#2b2b36]  max-w-md w-full p-6 sm:p-8 relative animate-fade-in text-gray-200 font-sans">
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-100 tracking-widest uppercase">MUAH AI</h2>
                <p className="text-xs text-gray-500 font-mono">Çoklu Ajan İşletim Sistemi</p>
              </div>

              <div className="space-y-6 py-4 border-y border-[#262630]/60">
                <div className="space-y-1">
                  <h3 className="text-gray-300 font-mono text-xs uppercase tracking-wide">Otomatik Mod</h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">
                    İstediğiniz sonuca ulaşmak için model seçimi otomatik yapılır.
                  </p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-gray-300 font-mono text-xs uppercase tracking-wide">Gelişmiş Ayarlar</h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">
                    Sağ üst menüden derinlemesine kontrol sağlayın.
                  </p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-gray-300 font-mono text-xs uppercase tracking-wide">Ajan Ekipleri</h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">
                    Karmaşık görevler için otonom çoklu ajan sistemini kullanın.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="onboarding-start-btn"
                  onClick={() => setShowOnboarding(false)}
                  className="w-full h-10 bg-gray-100 hover:bg-white text-[#111116] font-semibold text-xs tracking-widest uppercase transition-colors flex items-center justify-center"
                >
                  Onayla ve Başla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Command Bar Overlay */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        context={commandBarContext}
      />

      <CustomModelSettings 
        isOpen={isCustomSettingsOpen}
        onClose={() => setIsCustomSettingsOpen(false)}
        providers={customProviders}
        onSave={setCustomProviders}
      />

      <SystemLogPanel 
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
