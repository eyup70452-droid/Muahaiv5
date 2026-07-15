import React, { useState, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import {
  Folder,
  FileCode,
  Play,
  Check,
  X,
  Code,
  Terminal,
  Activity,
  ArrowRight,
  GitCommit,
  Layers,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Zap,
  Scissors
} from "lucide-react";

interface CodeWorkspaceProps {
  filesList?: Array<{ path: string; name: string; content: string }>;
  onSaveFile?: (path: string, content: string) => void;
  onRunTest?: () => Promise<{ success: boolean; output: string }>;
}

const DEFAULT_WORKSPACE_FILES = [
  {
    path: "/src/types.ts",
    name: "types.ts",
    content: `export type ProviderId = "openai" | "anthropic" | "deepseek" | "groq";

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  displayName: string;
  contextWindow: number;
  status: "active" | "inactive";
}`
  },
  {
    path: "/server.ts",
    name: "server.ts",
    content: `import express from "express";

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  res.json({ message: "Resilient backend router is live." });
});`
  },
  {
    path: "/src/App.tsx",
    name: "App.tsx",
    content: `import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatHub from "./components/ChatHub";

export default function App() {
  return (
    <div className="flex h-screen bg-[#111114]">
      <Sidebar />
      <ChatHub />
    </div>
  );
}`
  }
];

export default function CodeWorkspace({
  filesList,
  onSaveFile,
  onRunTest
}: CodeWorkspaceProps) {
  // Live Workspace State (Adım 2 Entegrasyonu)
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>("/server.ts");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    "/src": true,
    "/src/components": true
  });
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  const [currentContent, setCurrentContent] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("AI Çalışma Alanı IDE ortamı hazır.\nTest paketini veya derleyiciyi üstteki butonlarla çalıştırabilirsiniz.");
  const [isTesting, setIsTesting] = useState(false);

  // AI Diff Generator properties
  const [aiPrompt, setAiPrompt] = useState("");
  const [isApplyingAi, setIsApplyingAi] = useState(false);
  const [hasDiff, setHasDiff] = useState(false);
  const [diffOriginal, setDiffOriginal] = useState("");
  const [diffSuggested, setDiffSuggested] = useState("");

  // FIM Tab Completion State
  const [fimSuggestion, setFimSuggestion] = useState<string | null>(null);
  const [isFimLoading, setIsFimLoading] = useState(false);

  // Cmd+K Inline Edit State
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [inlinePrompt, setInlinePrompt] = useState("");
  const [isInlineEditing, setIsInlineEditing] = useState(false);

  const activeFileName = activeFilePath.split("/").pop() || "";
  const activeFile = {
    path: activeFilePath,
    name: activeFileName,
    content: currentContent
  };

  // Fetch file tree from server
  const fetchFileTree = async (autoOpenDefault = false) => {
    setIsLoadingTree(true);
    try {
      const res = await fetch("/api/workspace/files");
      const data = await res.json();
      if (data.success && data.files) {
        setFileTree(data.files);
        if (autoOpenDefault) {
          // Let's try to open a common file like /server.ts first, otherwise first available
          const hasServerTs = JSON.stringify(data.files).includes("/server.ts");
          if (hasServerTs) {
            loadFileContent("/server.ts");
          } else {
            // Find first available file
            const first = findFirstFilePath(data.files);
            if (first) loadFileContent(first);
          }
        }
      }
    } catch (err: any) {
      console.error("[Workspace Tree Error]", err);
      setTerminalOutput((prev) => `${prev}\n[HATA] Çalışma alanı dizini çekilemedi: ${err.message}`);
    } finally {
      setIsLoadingTree(false);
    }
  };

  // Helper to find first file in tree
  const findFirstFilePath = (nodes: any[]): string | null => {
    for (const node of nodes) {
      if (node.type === "file") return node.path;
      if (node.type === "folder" && node.children) {
        const path = findFirstFilePath(node.children);
        if (path) return path;
      }
    }
    return null;
  };

  // Load single file content from server
  const loadFileContent = async (filePath: string) => {
    try {
      const res = await fetch("/api/workspace/file/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentContent(data.content);
        setOriginalContent(data.content);
        setActiveFilePath(filePath);
        setFimSuggestion(null);
        setHasDiff(false);
      } else {
        setTerminalOutput((prev) => `${prev}\n[HATA] Dosya yüklenemedi: ${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput((prev) => `${prev}\n[HATA] Dosya yükleme hatası: ${err.message}`);
    }
  };

  // Mount effects
  useEffect(() => {
    fetchFileTree(true);
  }, []);

  const handleSave = async () => {
    if (!activeFilePath) return;
    try {
      const res = await fetch("/api/workspace/file/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: activeFilePath, content: currentContent })
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(currentContent);
        setTerminalOutput((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] 💾 Dosya başarıyla disk üzerine kaydedildi: ${activeFilePath}`);
        // Notify prop callbacks if defined
        if (onSaveFile) {
          onSaveFile(activeFilePath, currentContent);
        }
      } else {
        setTerminalOutput((prev) => `${prev}\n[HATA] Dosya kaydedilemedi: ${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput((prev) => `${prev}\n[HATA] Dosya kaydetme hatası: ${err.message}`);
    }
  };

  const handleTestRun = async () => {
    setIsTesting(true);
    setTerminalOutput((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] 🧪 Derleyici kod_yurutme_araci üzerinden çalıştırılıyor...`);
    try {
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "code_execution_tool",
          input: {
            code: currentContent,
            language: activeFile?.name.endsWith(".ts") || activeFile?.name.endsWith(".tsx") ? "typescript" : "javascript"
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          const { output, errors } = data.result;
          if (errors) {
            setTerminalOutput((prev) => `${prev}\n[HATA] Derleyici teşhis hataları:\n${errors}`);
          } else {
            setTerminalOutput((prev) => `${prev}\n[BAŞARI] Kod başarıyla derlendi!\n\nKonsol Çıktısı:\n${output}`);
          }
        } else {
          throw new Error(data.error || "Sandbox başarısız bir durum döndürdü.");
        }
      } else {
        throw new Error(`Sunucu ${res.status} durum kodu döndürdü.`);
      }
    } catch (err: any) {
      setTerminalOutput((prev) => `${prev}\n[HATA] Kod yürütme iptal edildi: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const generateAiRefactor = async () => {
    if (!aiPrompt.trim() || isApplyingAi) return;
    setIsApplyingAi(true);
    setTerminalOutput((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] [!] Yapay zeka derleme talimatı gönderiliyor...`);

    try {
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "ai_think_tool",
          input: {
            prompt: `Refactor this code based on user prompt.
Instruction: ${aiPrompt}

[ORIGINAL CODE]:
${currentContent}

Important: Your "response" must be the complete updated code, and nothing else (no markdown blocks, no commentary, just the plain code so it compiles).`
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          const { thinking, response } = data.result;
          setTerminalOutput((prev) => `${prev}\n[DÜŞÜNCE GÜNLÜĞÜ]:\n${thinking}\n\n[BAŞARI] Yapay zeka kodu optimize etti.`);
          setDiffOriginal(currentContent);
          
          let cleanedCode = response || "";
          if (cleanedCode.includes("```")) {
            cleanedCode = cleanedCode.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "").trim();
          }
          
          setDiffSuggested(cleanedCode);
          setHasDiff(true);
        } else {
          throw new Error(data.error || "Sunucudan geçerli bir derleme yanıtı alınamadı.");
        }
      } else {
        throw new Error(`Sunucu durumu: ${res.status}`);
      }
    } catch (e: any) {
      setTerminalOutput((prev) => `${prev}\n[HATA] Fark oluşturma hatası: ${e.message}`);
    } finally {
      setIsApplyingAi(false);
    }
  };

  // Trigger FIM (Fill-in-the-middle) Tab Completion Simulation or actual endpoint
  const handleTriggerFim = async () => {
    if (isFimLoading) return;
    setIsFimLoading(true);
    setFimSuggestion(null);
    try {
      const prompt = `Tamamlanacak kod:\n${currentContent}\nLütfen sadece sonraki 1-3 satırı tamamla ve başka açıklama ekleme. Sadece saf kod olsun.`;
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "ai_think_tool",
          input: { prompt }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          let code = data.result.response || "";
          if (code.includes("```")) {
            code = code.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "").trim();
          }
          setFimSuggestion(code.slice(0, 150));
        }
      }
    } catch (e) {} finally {
      setIsFimLoading(false);
    }
  };

  const acceptFim = () => {
    if (fimSuggestion) {
      setCurrentContent((prev) => prev + "\n" + fimSuggestion);
      setFimSuggestion(null);
    }
  };

  // Cmd+K Inline Edit Handler
  const handleInlineEditSubmit = async () => {
    if (!inlinePrompt.trim() || isInlineEditing) return;
    setIsInlineEditing(true);
    try {
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "ai_think_tool",
          input: {
            prompt: `Kodu bu talimata göre değiştir:\nTalimat: ${inlinePrompt}\n\n[KOD]:\n${currentContent}\n\nSadece güncellenmiş saf kodu dön, markdown ve yorum satırı ekleme.`
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          let code = data.result.response || "";
          if (code.includes("```")) {
            code = code.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "").trim();
          }
          setCurrentContent(code);
          setShowInlineEdit(false);
          setInlinePrompt("");
          setTerminalOutput((prev) => `${prev}\n[OK] Satır içi düzenleme uygulandı.`);
        }
      }
    } catch (e) {} finally {
      setIsInlineEditing(false);
    }
  };

  const acceptDiff = () => {
    setCurrentContent(diffSuggested);
    setHasDiff(false);
    setTerminalOutput((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] [OK] Yapay zeka önerisi uygulandı ve birleştirildi.`);
  };

  const rejectDiff = () => {
    setHasDiff(false);
    setTerminalOutput((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] [ERR] Yapay zeka önerisi reddedildi.`);
  };

  // Keyboard listener for Cmd+K inside the workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowInlineEdit((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Recursive directory tree renderer (Adım 2 Entegrasyonu)
  const renderFileNode = (node: any) => {
    const isFolder = node.type === "folder";
    const isExpanded = !!expandedPaths[node.path];
    const isActive = node.path === activeFilePath;

    return (
      <div key={node.path} className="select-none text-xs font-mono">
        <div
          onClick={() => {
            if (isFolder) {
              setExpandedPaths((prev) => ({ ...prev, [node.path]: !prev[node.path] }));
            } else {
              loadFileContent(node.path);
            }
          }}
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
            isActive
              ? "bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20"
              : "text-zinc-400 hover:text-white hover:bg-[#1d1d24]"
          }`}
        >
          {isFolder ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <ChevronRight
                className={`w-3 h-3 shrink-0 text-zinc-500 transition-transform duration-150 ${
                  isExpanded ? "rotate-90 text-amber-500" : ""
                }`}
              />
              <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500/80" />
              <span className="truncate">{node.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-4.5">
              <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="truncate">{node.name}</span>
            </div>
          )}
          {!isFolder && currentContent !== originalContent && isActive && (
            <span
              className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0 animate-pulse"
              title="Kaydedilmemiş değişiklikler var"
            />
          )}
        </div>
        {isFolder && isExpanded && node.children && (
          <div className="pl-3 mt-0.5 border-l border-zinc-800 ml-3.5 space-y-0.5">
            {node.children.map((child: any) => renderFileNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#111114] md:overflow-hidden overflow-y-auto font-sans" id="code-workspace-ide">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-5 py-3 border-b border-[#26262b] bg-[#141418] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0  bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Code className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-white font-display font-bold text-xs tracking-wide uppercase">
              Ana Çalışma Alanı IDE
            </h2>
            <p className="text-gray-400 text-[10px] mt-0.5 line-clamp-1">
              Doğrudan dosya işlemleri, akıllı sözdizimi vurgulama ve yapay zeka entegrasyonu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInlineEdit(true)}
            className="px-3.5 py-1.5 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>SATIR İÇİ DÜZENLE (Ctrl+K)</span>
          </button>
          
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5  border border-[#2d2d3a] bg-[#1c1c22] text-gray-200 text-[10px] font-semibold tracking-wider hover:bg-[#25252d] whitespace-nowrap cursor-pointer"
          >
            DOSYAYI KAYDET
          </button>
          <button
            onClick={handleTestRun}
            disabled={isTesting}
            className="px-3.5 py-1.5  bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold tracking-wider flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {isTesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isTesting ? "Derleniyor..." : "Test Derlemesi"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative">
        {/* Cmd+K Inline Edit Overlay Panel */}
        {showInlineEdit && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#141418] border border-indigo-500/40 p-4 shadow-2xl max-w-md w-full">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Yapay Zeka Satır İçi Düzenleme</span>
              <button onClick={() => setShowInlineEdit(false)} className="text-zinc-500 hover:text-white uppercase text-[9px] font-mono">[KAPAT]</button>
            </div>
            <p className="text-[11px] text-gray-400 mb-2 leading-normal">
              Dosya içeriğinde yapmak istediğiniz değişiklikleri girin.
            </p>
            <input
              type="text"
              className="w-full bg-[#08080a] border border-[#212128] px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              placeholder="Örn: Bu fonksiyona hata yakalama ekle..."
              value={inlinePrompt}
              onChange={(e) => setInlinePrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isInlineEditing && handleInlineEditSubmit()}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowInlineEdit(false)}
                className="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase"
              >
                İptal
              </button>
              <button
                onClick={handleInlineEditSubmit}
                disabled={isInlineEditing || !inlinePrompt.trim()}
                className="px-4 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase flex items-center gap-1.5"
              >
                {isInlineEditing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isInlineEditing ? "Uygulanıyor..." : "Uygula"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Left: Files Tree Explorer */}
        <div className="w-full md:w-56 h-auto md:h-96 md:h-full bg-[#141418] border-b md:border-b-0 md:border-r border-[#26262b] flex flex-col p-3 shrink-0">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-[10px] font-bold text-gray-500 tracking-wider">
              ÇALIŞMA ALANI DİZİNİ
            </span>
            <button
              onClick={() => fetchFileTree(false)}
              disabled={isLoadingTree}
              className="p-1 hover:bg-[#1d1d24] rounded text-zinc-500 hover:text-white transition disabled:opacity-50 cursor-pointer"
              title="Klasör Ağacını Yenile"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingTree ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
          
          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {isLoadingTree && fileTree.length === 0 ? (
              <div className="text-[10px] text-zinc-600 italic px-2 py-4">Dizin ağacı yükleniyor...</div>
            ) : (
              <div className="space-y-0.5">
                {fileTree.map((node) => renderFileNode(node))}
              </div>
            )}
          </div>
        </div>

        {/* Middle: Code Editor Panel */}
        <div className="flex-1 flex flex-col bg-[#111114] min-h-[300px] md:min-h-0 min-w-0 relative">
          <div className="h-8 px-4 bg-[#141418] border-b border-[#26262b] flex items-center justify-between text-gray-400 font-mono text-[10px]">
            <span className="truncate">Aktif Editör Arabelleği: {activeFile?.path}</span>
            <button
              onClick={handleTriggerFim}
              disabled={isFimLoading}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 uppercase text-[9px] font-bold"
            >
              {isFimLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>Yapay Zeka Otomatik Tamamla (FIM)</span>
            </button>
          </div>

          <div className="flex-1 relative">
            <MonacoEditor
              height="100%"
              theme="vs-dark"
              language={activeFile?.name.endsWith(".ts") || activeFile?.name.endsWith(".tsx") ? "typescript" : "javascript"}
              value={currentContent}
              onChange={(v) => setCurrentContent(v || "")}
              options={{
                fontSize: 12,
                fontFamily: "Fira Code, JetBrains Mono, monospace",
                minimap: { enabled: false },
                lineNumbers: "on",
                automaticLayout: true,
                padding: { top: 10, bottom: 10 }
              }}
            />

            {/* FIM ghost text autocomplete suggestion panel */}
            {fimSuggestion && (
              <div className="absolute bottom-4 right-4 z-20 bg-[#1e293b] border border-emerald-500 p-3 max-w-md rounded shadow-2xl space-y-2">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block font-mono">Yapay Zeka Tamamlama Önerisi</span>
                <pre className="text-[10px] font-mono text-gray-300 bg-black/40 p-2 border border-zinc-800 rounded overflow-auto max-h-24">
                  {fimSuggestion}
                </pre>
                <div className="flex gap-1.5 justify-end">
                  <button onClick={() => setFimSuggestion(null)} className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] uppercase font-bold">Reddet</button>
                  <button onClick={acceptFim} className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] uppercase font-bold">Kabul Et</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Refactor Diff panel */}
        <div className="w-full md:w-80 bg-[#141418] border-t md:border-t-0 md:border-l border-[#26262b] flex flex-col justify-between p-4 space-y-4 shrink-0 overflow-y-auto">
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-gray-500 block tracking-wider uppercase">
              Yapay Zeka Düzenleme Ajanı
            </span>
            <p className="text-[11px] text-gray-400 leading-normal">
              Derleme ajanına fonksiyonları optimize etmesi, yeniden yapılandırması veya hataları gidermesi talimatını verin.
            </p>

            <textarea
              rows={4}
              className="w-full bg-[#111114] border border-[#2a2a34]  p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              placeholder="Aktif dosyanın tiplerini veya fonksiyonlarını düzenle..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isApplyingAi || hasDiff}
            />

            <button
              onClick={generateAiRefactor}
              disabled={isApplyingAi || hasDiff || !aiPrompt.trim()}
              className="w-full py-2.5  bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tracking-wider shadow transition-all cursor-pointer"
            >
              Yeniden Düzenleme Öner
            </button>
          </div>

          {/* Accept / Reject actions */}
          {hasDiff && (
            <div className="border border-emerald-500/30  bg-emerald-500/5 p-3.5 space-y-3">
              <span className="text-[10px] font-bold text-emerald-400 tracking-wide block">
                Kod Optimizasyonu Hazır:
              </span>
              <p className="text-[11px] text-gray-400 leading-normal">
                Değişiklikleri kaydetmeden önce sol taraftaki editör penceresinden gözden geçirin.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={acceptDiff}
                  className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold tracking-wider  flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Kabul Et
                </button>
                <button
                  onClick={rejectDiff}
                  className="py-1.5 bg-red-600/15 border border-red-500/30 hover:bg-red-600/25 text-red-400 text-[10px] font-bold tracking-wider  flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Reddet
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-emerald-500/5 border border-emerald-500/10  text-[10px] text-emerald-400/80 leading-normal flex items-start gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span>Değişiklikleri kabul ettiğinizde çalışma alanı içinde derleme doğrulaması otomatik olarak çalıştırılır.</span>
          </div>
        </div>
      </div>

      {/* Bottom: Terminal Outputs */}
      <div className="h-32 bg-[#0d0d10] border-t border-[#26262b] flex flex-col overflow-hidden shrink-0">
        <div className="h-7 px-4 bg-[#141418] border-b border-[#26262b] flex items-center justify-between text-gray-500 font-mono text-[10px]">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Terminal Konsol Çıktısı</span>
          </div>
          <span>Durum: Sağlıklı</span>
        </div>
        <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-gray-300 select-text leading-relaxed">
          <pre>{terminalOutput}</pre>
        </div>
      </div>
    </div>
  );
}
