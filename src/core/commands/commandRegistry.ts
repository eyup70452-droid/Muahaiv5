export interface CommandContext {
  setActivePanel?: (panel: string) => void;
  runTool?: (toolId: string, input: any) => Promise<any>;
  clearChat?: () => void;
  resetWorkspace?: () => void;
  addSystemMessage?: (content: string, toolCalls?: any[]) => void;
  toggleTheme?: () => void;
  sendMessage?: (text: string, mode?: string, systemInstruction?: string, aiMode?: "fast" | "balanced" | "deep" | "agent" | "planner" | "swarm" | "research") => void;
}

export interface Command {
  id: string;
  label: string;
  description: string;
  category: "navigation" | "ai" | "tools" | "system";
  shortcut?: string;
  action: (context: CommandContext) => void | Promise<void>;
}

export const commandRegistry: Command[] = [
  // Navigation Commands
  {
    id: "nav_chat",
    label: "Sohbet Paneline Git",
    description: "Ana sohbet modülünü (Chat Hub) aktif hale getirir.",
    category: "navigation",
    shortcut: "G C",
    action: (ctx) => {
      if (ctx.setActivePanel) ctx.setActivePanel("chat");
    }
  },
  {
    id: "nav_code",
    label: "Kodlama Paneline Git",
    description: "Yalıtılmış Kodlama Çalışma Alanını (Code Workspace) açar.",
    category: "navigation",
    shortcut: "G W",
    action: (ctx) => {
      if (ctx.setActivePanel) ctx.setActivePanel("code");
    }
  },
  {
    id: "nav_research",
    label: "Derin Araştırma Modülüne Git",
    description: "İnternet tarama ve Derin Araştırma (Deep Research) panelini açar.",
    category: "navigation",
    shortcut: "G R",
    action: (ctx) => {
      if (ctx.setActivePanel) ctx.setActivePanel("research");
    }
  },
  {
    id: "nav_media",
    label: "Yaratıcı Medya Stüdyosuna Git",
    description: "SVG görsel üretimi ve Ses Sentezi modülünü açar.",
    category: "navigation",
    shortcut: "G M",
    action: (ctx) => {
      if (ctx.setActivePanel) ctx.setActivePanel("media");
    }
  },
  {
    id: "nav_data",
    label: "Veri Analiz Modülüne Git",
    description: "CSV/Dosya yükleme ve veri analizi panelini açar.",
    category: "navigation",
    shortcut: "G D",
    action: (ctx) => {
      if (ctx.setActivePanel) ctx.setActivePanel("data");
    }
  },

  {
    id: "nav_memory",
    label: "Hafıza Modülüne Git",
    description: "Bilişsel bellek ve uzun vadeli hafıza panelini açar.",
    category: "navigation",
    shortcut: "G H",
    action: (ctx) => {
      if (ctx.setActivePanel) ctx.setActivePanel("memory");
    }
  },
  {
    id: "run_planner",
    label: "Bilişsel Planlayıcıyı Çalıştır",
    description: "Belirtilen hedef için teknik yol haritası (Planner Agent) oluşturur.",
    category: "ai",
    action: (ctx) => {
      if (ctx.sendMessage) {
        ctx.sendMessage("Gelecek 1 saatlik geliştirme planını oluştur.", "best_match", "", "planner");
      }
    }
  },
  {
    id: "run_swarm",
    label: "Swarm Kolektif Zekasını Başlat",
    description: "Çoklu ajan ekibini (Multi-Agent Swarm) görevlendirir.",
    category: "ai",
    action: (ctx) => {
      if (ctx.sendMessage) {
        ctx.sendMessage("Tüm sistemin güvenlik denetimini yap ve raporla.", "best_match", "", "swarm");
      }
    }
  },
  // AI & Tools Commands
  {
    id: "run_deep_think",
    label: "Derin Düşünce Simülasyonu Çalıştır",
    description: "Çok aşamalı düşünce zincirini (deep_think_tool) tetikler.",
    category: "ai",
    shortcut: "T D",
    action: async (ctx) => {
      if (ctx.runTool && ctx.addSystemMessage) {
        ctx.addSystemMessage("Derin Düşünce Analiz Motoru başlatılıyor...");
        const result = await ctx.runTool("deep_think_tool", { prompt: "Sistem durum optimizasyon analizi", steps: 3 });
        if (result.success) {
          ctx.addSystemMessage(
            `🧠 **Muhakeme Analizi Başarılı**\n\nAdımlar:\n${result.output.thinkingProcess.join("\n")}\n\nKarar: ${result.output.finalDecision}`,
            [result]
          );
        } else {
          ctx.addSystemMessage(`❌ Muhakeme hatası: ${result.error}`);
        }
      }
    }
  },
  {
    id: "run_web_search",
    label: "Web Arama Motorunu Çalıştır",
    description: "İnternette arama yapar (web_search_tool).",
    category: "tools",
    shortcut: "T S",
    action: async (ctx) => {
      if (ctx.runTool && ctx.addSystemMessage) {
        ctx.addSystemMessage("Web Arama Motoru çalıştırılıyor...");
        const result = await ctx.runTool("web_search_tool", { query: "React 19 ve Vite 6 yenilikleri" });
        if (result.success) {
          const resultsStr = result.output.results.map((r: any) => `* **${r.title}** (${r.url})\n  ${r.snippet}`).join("\n");
          ctx.addSystemMessage(
            `🔍 **Arama Sonuçları (Kaynak: ${result.output.source})**\n\n${resultsStr}`,
            [result]
          );
        } else {
          ctx.addSystemMessage(`❌ Web Arama hatası: ${result.error}`);
        }
      }
    }
  },
  {
    id: "run_sandbox_compile",
    label: "Güvenli Sandbox Derleyicisi",
    description: "Varsayılan test betiğini sanal ortamda derler.",
    category: "tools",
    shortcut: "T C",
    action: async (ctx) => {
      if (ctx.runTool && ctx.addSystemMessage) {
        ctx.addSystemMessage("Sanal sandbox derleniyor...");
        const codeSample = `const nums = [1, 2, 3, 4, 5];\nconst squared = nums.map(n => n * n);\nconsole.log("Kareler listesi:", squared);`;
        const result = await ctx.runTool("code_execution_tool", { code: codeSample, language: "typescript" });
        if (result.success) {
          ctx.addSystemMessage(
            `💻 **Sandbox Kod Derleme Başarılı**\n\nÇalıştırılan Kod:\n\`\`\`typescript\n${codeSample}\n\`\`\`\n\nKonsol Çıktısı:\n\`\`\`\n${result.output.output}\n\`\`\``,
            [result]
          );
        } else {
          ctx.addSystemMessage(`❌ Derleme hatası: ${result.error}`);
        }
      }
    }
  },
  {
    id: "summarize_context",
    label: "Oturum Bağlamını Özetle",
    description: "Mevcut oturumun hafıza kaydını özetler.",
    category: "ai",
    action: async (ctx) => {
      if (ctx.runTool && ctx.addSystemMessage) {
        const result = await ctx.runTool("context_memory_tool", { action: "get_all" });
        if (result.success) {
          ctx.addSystemMessage(
            `📋 **Oturum Bağlamı Raporu**\n\nBellekteki veriler:\n\`\`\`json\n${JSON.stringify(result.output.currentStore, null, 2)}\n\`\`\``,
            [result]
          );
        }
      }
    }
  },

  // System Commands
  {
    id: "clear_chat",
    label: "Sohbet Geçmişini Temizle",
    description: "Aktif sohbet oturumunun mesaj geçmişini sıfırlar.",
    category: "system",
    shortcut: "S C",
    action: (ctx) => {
      if (ctx.clearChat) ctx.clearChat();
    }
  },
  {
    id: "reset_workspace",
    label: "Çalışma Alanını Sıfırla",
    description: "Tüm sistem hafızasını ve yüklü dosyaları sıfırlar.",
    category: "system",
    action: async (ctx) => {
      if (ctx.resetWorkspace) {
        ctx.resetWorkspace();
      }
      if (ctx.runTool) {
        await ctx.runTool("context_memory_tool", { action: "clear" });
      }
      if (ctx.addSystemMessage) {
        ctx.addSystemMessage("🔄 Tüm sistem ayarları, yüklenen dosyalar ve oturum hafızası başarıyla sıfırlandı.");
      }
    }
  },
  {
    id: "toggle_theme",
    label: "Görsel Temayı Değiştir",
    description: "Açık ve koyu tema modları arasında geçiş yapar.",
    category: "system",
    shortcut: "S T",
    action: (ctx) => {
      if (ctx.toggleTheme) ctx.toggleTheme();
    }
  }
];
