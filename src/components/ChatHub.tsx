import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Sparkles,
  Layers,
  Zap,
  Info,
  Check,
  Copy,
  Clock,
  Coins,
  Brain,
  ChevronDown,
  ChevronUp,
  Settings,
  Settings2,
  HelpCircle,
  Plus,
  Globe,
  FileText,
  Paperclip,
  Code,
  Sliders,
  Terminal,
  Activity,
  User,
  Shield,
  Menu,
  ChevronRight,
  Upload,
  BookOpen,
  Search,
  CheckCircle2,
  Cpu,
  Trash2,
  Play,
  Volume2,
  Image,
  BarChart2,
  ExternalLink,
  Download,
  Heart,
  MessageSquare,
  Mic,
  MicOff,
  X,
  XCircle,
  RotateCw,
  History,
  MessageSquarePlus,
  Trash,
  PanelRight,
  ArrowRight,
  Lightbulb
} from "lucide-react";
import NeuralRoutingVisualizer from "./NeuralRoutingVisualizer";
import SystemNotificationCenter from "./SystemNotificationCenter";
import { ChatMessage, ModelInfo, ProviderInfo, FileMetadata, CustomProvider } from "../types";
import { copyTextToClipboard } from "../core/utils/clipboard";
import { ThinkingAnimation } from "./ThinkingAnimation";
import { FileExplorer, FileNode } from "./FileExplorer";

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((s) => !s)}
        className="w-3.5 h-3.5 rounded-full bg-white/10 text-gray-400 text-[9px] flex items-center justify-center hover:bg-white/20 transition cursor-help font-semibold"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5  bg-[#1a1a20] border border-[#2a2a32] text-[11px] text-gray-300 shadow-xl z-50 pointer-events-none leading-normal font-normal normal-case">
          {text}
        </div>
      )}
    </span>
  );
}

interface ChatHubProps {
  messages: ChatMessage[];
  models: ModelInfo[];
  providers: ProviderInfo[];
  activeModelIds: string[];
  onSendMessage: (text: string, routingMode: string, customSystemInstruction: string, aiMode: "fast" | "balanced" | "deep" | "agent" | "swarm" | "research" | "planner", isContinue?: boolean, effortLevel?: "low" | "medium" | "high" | "max", behaviorMode?: "normal" | "assistant" | "expert" | "architect", selectedModelId?: string, deepThinkEnabled?: boolean) => void;
  onAbort?: () => void;
  onSelectModel?: (modelId: string) => void;
  isSending: boolean;
  routingMode: "manuel" | "parallel" | "best_match";
  onChangeRoutingMode: (mode: "manuel" | "parallel" | "best_match") => void;
  systemInstruction: string;
  onUpdateSystemInstruction: (val: string) => void;
  onNewChat: () => void;
  onClearHistory: () => void;
  onToggleHistory: () => void;
  onToggleDiagnostics?: () => void;
  freeOnly?: boolean;
  customProviders?: CustomProvider[];
  onActivateCustomProvider?: (id: string) => void;

  // Integrated cognitive tools props
  files: FileMetadata[];
  onUploadFile: (name: string, size: number, content: string) => Promise<void>;
  onRemoveFile: (id: string) => void;
  onQueryFileContent: (query: string, fileContents: string) => Promise<string>;
  onDeepResearch: (topic: string) => Promise<any>;
  onGenerateImage: (prompt: string) => Promise<any>;
  onSynthesizeSpeech: (text: string) => Promise<any>;
}

// Format markdown/think helper with elegant design
function CodeBlock({ node, inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '');
  const isRunnable = match && (match[1] === 'javascript' || match[1] === 'typescript' || match[1] === 'js' || match[1] === 'ts');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  
  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    try {
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "code_execution_tool",
          input: {
            code: String(children).replace(/\n$/, ''),
            language: match[1]
          }
        })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setOutput(data.result.errors || data.result.output || "No output");
      } else {
        setOutput("Error: " + (data.error || "Execution failed"));
      }
    } catch (e: any) {
      setOutput("Error: " + e.message);
    } finally {
      setIsRunning(false);
    }
  };

  if (!inline && match) {
    return (
      <div className="relative group  overflow-hidden my-4 border border-[#232328]">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a22] border-b border-[#232328]">
          <span className="text-xs font-mono text-gray-400">{match[1]}</span>
          {isRunnable && (
            <button
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[10px] font-semibold transition disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              {isRunning ? "Çalışıyor..." : "Çalıştır"}
            </button>
          )}
        </div>
        <div className="p-3 bg-[#09090b] overflow-x-auto text-sm">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
        {output && (
          <div className="border-t border-[#232328] bg-[#0c0c0f] p-3 text-xs font-mono text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    );
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function AnimatedMarkdown({ 
  content, 
  enabled, 
  aiMode, 
  isStreaming,
  toolCalls 
}: { 
  content: string, 
  enabled?: boolean, 
  aiMode?: string, 
  isStreaming?: boolean,
  toolCalls?: any[]
}) {
  const [displayedText, setDisplayedText] = useState(content);
  
  useEffect(() => {
    setDisplayedText(content);
  }, [content]);

  return (
    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-transparent prose-pre:border-0 prose-pre:p-0 prose-p:leading-relaxed text-gray-300 font-sans relative">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{ code: CodeBlock }}
      >
        {displayedText}
      </ReactMarkdown>
      {isStreaming && (
        <ThinkingAnimation 
          aiMode={aiMode} 
          status={toolCalls && toolCalls.some(t => !t.success && !t.output) ? "Araç Çalıştırılıyor..." : undefined}
        />
      )}
    </div>
  );
}

function RenderFormattedContent({ 
  content, 
  reasoning, 
  toolCalls,
  isLatestAssistantMessage,
  aiMode,
  isStreaming
}: { 
  content: string; 
  reasoning?: string; 
  toolCalls?: any[];
  isLatestAssistantMessage?: boolean;
  aiMode?: string;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);

  // Auto-expand thinking panel when streaming or if content is empty (e.g. only thinking process exists so far)
  useEffect(() => {
    if (isStreaming || (!content && reasoning)) {
      setIsThinkingExpanded(true);
    }
  }, [isStreaming, content, reasoning]);

  const copyToClipboard = async (text: string, blockId: string) => {
    await copyTextToClipboard(text);
    setCopied(blockId);
    setTimeout(() => setCopied(null), 2000);
  };

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3.5 text-sm text-gray-300 leading-relaxed font-sans">
      
      {/* Real Reasoning / Akıl Yürütme */}
      {reasoning && (
        <div className="mb-4 bg-zinc-900/10 border border-zinc-800/40 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm">
          <div 
            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
            className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/20 border-b border-zinc-900/30 cursor-pointer select-none hover:bg-zinc-900/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-wider text-zinc-400 font-mono uppercase">
                Akıl Yürütme Süreci (CoT)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono">
              <span className="font-semibold tracking-wider">{isThinkingExpanded ? "GİZLE" : "GÖSTER"}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isThinkingExpanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          
          {isThinkingExpanded && (
            <div className="p-4 font-mono text-[11px] text-zinc-400/90 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap bg-zinc-950/10 border-t border-zinc-950/25 select-text scrollbar-thin scrollbar-thumb-zinc-800/80 scrollbar-track-transparent">
              {reasoning}
              {isStreaming && !content && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-rose-400 animate-pulse" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Sources Section */}
      {toolCalls?.some(tc => tc.toolId === "web_search_tool" && tc.output?.results) && (
        <div className="mt-4 pt-3 border-t border-[#23232a]/60">
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <ExternalLink className="w-3 h-3" />
            <span>Kullanılan Kaynaklar</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {toolCalls
              .filter(tc => tc.toolId === "web_search_tool" && tc.output?.results)
              .flatMap(tc => tc.output.results.slice(0, 5))
              .map((res: any, i: number) => {
                try {
                  const url = new URL(res.url);
                  return (
                    <a 
                      key={i}
                      href={res.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-2 py-1  bg-[#16161c] border border-[#23232a] text-[9px] text-gray-300 hover:text-blue-300 hover:border-blue-500/30 transition group max-w-[200px]"
                    >
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`} 
                        alt="" 
                        className="w-3 h-3  opacity-60 group-hover:opacity-100"
                        referrerPolicy="no-referrer"
                      />
                      <span className="truncate">{res.title || res.url}</span>
                    </a>
                  );
                } catch (e) {
                  return null;
                }
              })}
          </div>
        </div>
      )}

      {/* ReactMarkdown inside the content wrapper */}
      <AnimatedMarkdown content={content} enabled={isLatestAssistantMessage} aiMode={aiMode} isStreaming={isStreaming} toolCalls={toolCalls} />
    </div>
  );
}

export function SimpleSpinner({ modelId }: { modelId?: string }) {
  return (
    <div className="border border-[#23232c] bg-[#111116] rounded-[16px] rounded-tl-[4px] px-4 py-3 shadow-xl font-sans max-w-[85%] mr-auto flex items-center justify-between gap-3 my-4 animate-fade-in" id="muah-simple-spinner-container">
      <div className="flex items-center gap-2.5">
        <div className="w-4 h-4 border-2 border-fuchsia-500/20 border-t-fuchsia-500 rounded-full animate-spin" />
        <span className="text-xs text-gray-300 font-medium">
          Yapay zekâ yanıt hazırlıyor...
        </span>
      </div>
      <span className="text-[9px] text-zinc-500 font-mono bg-[#17171f] px-2.5 py-0.5 border border-[#212126] rounded-full">
        {modelId ? modelId.split('/').pop()?.toUpperCase() : "COGNITIVE ROUTER"}
      </span>
    </div>
  );
}

export function MuahThinkingSteps({ modelId, routingReason }: { modelId?: string; routingReason?: string }) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    { label: "Sorgu semantiği ve kullanıcı niyeti analiz ediliyor...", duration: 600 },
    { label: `${modelId ? `${modelId.toUpperCase()} modeli` : "En uygun büyük dil modeli"} seçiliyor ve optimize ediliyor...`, duration: 800 },
    { label: "Uzun vadeli bellek (episodic memory) kayıtları sorgulanıyor...", duration: 700 },
    { label: "Dosya bağlamı ve sistem talimatları derleniyor...", duration: 600 },
    { label: "Bilişsel akıl yürütme (reasoning engine) başlatılıyor...", duration: 900 },
    { label: "Yanıt akışı hazırlanıyor ve asistan yanıtlıyor...", duration: 1000 }
  ];

  useEffect(() => {
    let active = true;
    const runSteps = (index: number) => {
      if (!active) return;
      if (index >= steps.length - 1) return;
      setTimeout(() => {
        if (!active) return;
        setCurrentStep(index + 1);
        runSteps(index + 1);
      }, steps[index].duration);
    };
    runSteps(0);
    return () => {
      active = false;
    };
  }, [modelId]);

  return (
    <div className="border border-[#23232c] bg-[#111116] rounded-[24px] rounded-tl-[4px] p-6 shadow-2xl font-sans max-w-[85%] mr-auto flex flex-col gap-4 my-4 animate-fade-in relative overflow-hidden" id="muah-thinking-steps-container">
      {/* Top ambient glowing neon border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 opacity-90" />
      <style>{`
        @keyframes muahWaveAnim {
          0% { transform: scaleY(0.2); }
          100% { transform: scaleY(1.1); }
        }
        @keyframes muahGlowPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-[#212126]/50 pb-2.5">
        <div className="flex items-center gap-2">
          {/* Pulsing indicator */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="font-extrabold text-[11px] text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 uppercase tracking-widest">
            Muah AI Bilişsel İşlemci
          </span>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 bg-[#17171f] px-2.5 py-0.5 border border-[#212126] rounded-full">
          {modelId ? modelId.split('/').pop()?.toUpperCase() : "COGNITIVE ROUTER"}
        </span>
      </div>

      {/* Steps List */}
      <div className="space-y-3.5 pl-1">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 transition-all duration-300 ${
                isCompleted ? "opacity-55" : isActive ? "opacity-100 scale-[1.01]" : "opacity-25"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                ) : isActive ? (
                  <div className="w-4.5 h-4.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-500" />
                  </div>
                ) : (
                  <div className="w-4.5 h-4.5 rounded-full bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-semibold block leading-relaxed ${isActive ? "text-fuchsia-300" : "text-gray-300"}`}>
                  {step.label}
                </span>
                {isActive && idx === 1 && routingReason && (
                  <span className="text-[10px] text-zinc-500 italic mt-0.5 block leading-normal">
                    💡 {routingReason}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Siri/Alexa-style magical neural wave visualization */}
      <div className="flex items-center justify-center gap-1 py-2 bg-[#0e0e11] rounded-2xl border border-[#1d1d23] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-fuchsia-500/5 to-indigo-500/5 opacity-50" />
        <div className="flex items-center gap-2 relative z-10">
          <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Muah Düşünme Dalgaları</span>
          <div className="flex items-center gap-[3px] h-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => {
              const baseDurations = [1.2, 0.8, 1.4, 0.9, 1.1, 0.7, 1.3, 1.0, 1.2, 0.9, 1.1, 0.8];
              const colors = [
                "bg-rose-400", "bg-fuchsia-400", "bg-indigo-400",
                "bg-rose-500", "bg-fuchsia-500", "bg-indigo-500",
                "bg-rose-400", "bg-fuchsia-400", "bg-indigo-400",
                "bg-rose-500", "bg-fuchsia-500", "bg-indigo-500"
              ];
              return (
                <div
                  key={i}
                  className={`w-[2.5px] h-4 rounded-full ${colors[i - 1]} opacity-80 origin-center`}
                  style={{
                    animation: `muahWaveAnim ${baseDurations[i - 1]}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.08}s`
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatHub({
  messages,
  models,
  providers,
  activeModelIds,
  onSendMessage,
  onAbort,
  onSelectModel,
  isSending,
  routingMode,
  onChangeRoutingMode,
  systemInstruction,
  onUpdateSystemInstruction,
  onNewChat,
  onClearHistory,
  onToggleHistory,
  onToggleDiagnostics,
  freeOnly,
  customProviders,
  onActivateCustomProvider,

  // Tools Props
  files,
  onUploadFile,
  onRemoveFile,
  onQueryFileContent,
  onDeepResearch,
  onGenerateImage,
  onSynthesizeSpeech
}: ChatHubProps) {
  const [inputText, setInputText] = useState("");
  const [showOutputsPanel, setShowOutputsPanel] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ id: string; name: string; size: number; createdAt: string; url: string }>>([]);

  const fetchGeneratedFiles = async () => {
    try {
      const res = await fetch("/api/files/list");
      const data = await res.json();
      if (data.success) {
        setGeneratedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error fetching generated files:", err);
    }
  };

  const deleteGeneratedFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showNotification("Dosya başarıyla silindi.", "success");
        fetchGeneratedFiles();
      } else {
        showNotification(data.error || "Dosya silinemedi.", "error");
      }
    } catch (err: any) {
      showNotification(err.message || "Dosya silinirken hata oluştu.", "error");
    }
  };

  useEffect(() => {
    fetchGeneratedFiles();
  }, []);

  // Fetch generated files when isSending becomes false
  useEffect(() => {
    if (!isSending) {
      const timer = setTimeout(() => {
        fetchGeneratedFiles();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isSending]);

  const [notification, setNotification] = useState<{ type: "error" | "info" | "success"; message: string } | null>(null);

  const showNotification = (message: string, type: "error" | "info" | "success" = "error") => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };
  
  // Toggles for Advanced Options popover next to input box
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // States inside settings popover
  const [selectedModelType, setSelectedModelType] = useState<string>("auto");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [effortLevel, setEffortLevel] = useState<"low" | "medium" | "high" | "max">("medium");
  const [behaviorMode, setBehaviorMode] = useState<"normal" | "assistant" | "expert" | "architect">("normal");
  const [aiMode, setAiMode] = useState<"fast" | "balanced" | "deep" | "agent" | "swarm" | "research" | "planner">("balanced");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial routing mode on mount
  useEffect(() => {
    if (selectedModelType === "auto") {
      onChangeRoutingMode("best_match");
    } else if (selectedModelType === "hybrid") {
      onChangeRoutingMode("parallel");
    }
  }, []);

  // Sync external active model state
  useEffect(() => {
    if (activeModelIds && activeModelIds.length > 0) {
      if (selectedModelType !== "auto" && selectedModelType !== "hybrid") {
        setSelectedModelType(activeModelIds[0]);
      } else if (selectedModelType === "auto") {
        setSelectedModelType(activeModelIds[0]);
      }
    }
  }, [activeModelIds]);

  const [showToolMenu, setShowToolMenu] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement>(null);

  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setNotification({ type: "error", message: "Tarayıcınız ses tanımayı desteklemiyor." });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setNotification({ type: "info", message: "Dinleniyor..." });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev + (prev ? " " : "") + transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setNotification({ type: "error", message: `Hata: ${event.error}` });
    };

    recognition.onend = () => {
      setIsListening(false);
      setNotification(null);
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    }
    if (isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolMenuRef.current && !toolMenuRef.current.contains(event.target as Node)) {
        setShowToolMenu(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowToolMenu(false);
      }
    }
    if (showToolMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showToolMenu]);

  const [webResearchEnabled, setWebResearchEnabled] = useState(false);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [googleSearchMode, setGoogleSearchMode] = useState(false);

  // Integrated Deep Research states
  const [researchTopic, setResearchTopic] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [researchReport, setResearchReport] = useState("");
  const [researchLogs, setResearchLogs] = useState<string[]>([]);
  const [researchStep, setResearchStep] = useState(0);

  // Integrated Media states
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [isSynthesizingSpeech, setIsSynthesizingSpeech] = useState(false);
  const [waveData, setWaveData] = useState<number[]>([]);

  // Integrated Sandbox states
  const [sandboxCode, setSandboxCode] = useState(`// Enforce isolated memory limits\nconst data = [10, 20, 35, 50, 80];\nconst sum = data.map(x => x * 2).reduce((a, b) => a + b, 0);\nconsole.log("Memory Buffer Sum:", sum);`);
  const [sandboxLogs, setSandboxLogs] = useState("");
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [generatedChartSvg, setGeneratedChartSvg] = useState<string | null>(null);

  // File Upload drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [fileQueryResult, setFileQueryResult] = useState("");
  const [isQueryingFile, setIsQueryingFile] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById("topbar-settings-anchor"));
  }, []);

  // Pipeline step tracker
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [previousScrollTop, setPreviousScrollTop] = useState<number | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  // Handle scroll events to show/hide scroll button
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setShowScrollButton(scrollTop < scrollHeight - clientHeight - 150);
      }
    };
    const container = scrollRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => container?.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      setPreviousScrollTop(scrollRef.current.scrollTop);
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  const scrollToPrevious = () => {
    if (scrollRef.current && previousScrollTop !== null) {
      scrollRef.current.scrollTo({
        top: previousScrollTop,
        behavior: "smooth"
      });
      setPreviousScrollTop(null);
    }
  };

  // Simulated auto-routing animation steps
  useEffect(() => {
    if (isSending) {
      setPipelineStep(1);
      const timer1 = setTimeout(() => setPipelineStep(2), 600);
      const timer2 = setTimeout(() => setPipelineStep(3), 1200);
      const timer3 = setTimeout(() => setPipelineStep(4), 1800);
      const timer4 = setTimeout(() => setPipelineStep(5), 2400);
      const timer5 = setTimeout(() => setPipelineStep(6), 3000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        clearTimeout(timer5);
      };
    } else {
      setPipelineStep(0);
    }
  }, [isSending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = !!inputText.trim();
    const hasFiles = files && files.length > 0;
    if ((!hasText && !hasFiles) || isSending) return;

    // Inject parameters dynamically based on options
    let customInstructions = systemInstruction || "";
    
    if (behaviorMode === "assistant") {
      customInstructions += "\n[BEHAVIOR: ASSISTANT - Açıklayıcı, profesyonel ve yapıcı olun.]";
    } else if (behaviorMode === "expert") {
      customInstructions += "\n[BEHAVIOR: EXPERT - Sıkı tip güvenliğine sahip, üst düzey ve teknik yazılım kodları üretin.]";
    } else if (behaviorMode === "architect") {
      customInstructions += "\n[BEHAVIOR: ARCHITECT - Geniş ölçekli yazılım sistem tasarımları ve mantıksal mimariler çizin.]";
    }

    customInstructions += `\n[EFFORT LEVEL: ${effortLevel.toUpperCase()}]`;
    if (effortLevel === "max") {
      customInstructions += "\n[CRITICAL: Derin düşünme blokları oluşturun ve çıktıyı tamamlamadan önce adım adım düşünün.]";
    }

    if (webResearchEnabled || googleSearchMode) {
      customInstructions += "\n[WEB_SEARCH_REQUIRED]";
    }
    if (deepThinkEnabled) {
      customInstructions += "\n[DEEP COGNITIVE THINKING: ACTIVE - Mantıksal çıkarımları <think>...</think> bloklarında toplayın.]";
    }

    onSendMessage(inputText.trim(), routingMode, customInstructions, aiMode, false, effortLevel, behaviorMode, selectedModelType, deepThinkEnabled);
    setInputText("");
    setShowOnboarding(false);
  };

  // Model Metadata Helpers
  const getModelColor = (modelId?: string): string => {
    if (!modelId) return "border-zinc-700 bg-zinc-800";
    const model = models.find((m) => m.id === modelId);
    if (!model) return "border-zinc-700 bg-zinc-800";
    const provider = providers.find((p) => p.id === model.provider);
    return provider?.color || "border-zinc-700 bg-zinc-800";
  };

  const getModelDisplayName = (modelId?: string): string => {
    if (!modelId || modelId === "system") return "Sistem Yönlendirici";
    
    const found = models.find((m) => m.id === modelId);
    if (found) return found.displayName;
    
    // Better mapping for technical IDs
    const lowerId = modelId.toLowerCase();
    if (lowerId.includes("gpt-4o-mini")) return "GPT-4o Mini";
    if (lowerId.includes("gpt-4o")) return "GPT-4o Professional";
    if (lowerId.includes("gpt-4-turbo")) return "GPT-4 Turbo";
    if (lowerId.includes("claude-3-5-sonnet")) return "Claude 3.5 Sonnet";
    if (lowerId.includes("claude-3-5-haiku")) return "Claude 3.5 Haiku";
    if (lowerId.includes("claude-3-opus")) return "Claude 3 Opus";
    if (lowerId.includes("llama-3.1-405b")) return "Llama 3.1 (405B) Instruct";
    if (lowerId.includes("llama-3.1-70b")) return "Llama 3.1 70B Instruct";
    if (lowerId.includes("llama-3.1-8b")) return "Llama 3.1 8B Instruct";
    if (lowerId.includes("deepseek-v3")) return "DeepSeek V3";
    if (lowerId.includes("deepseek-r1")) return "DeepSeek R1 (Reasoning)";
    if (lowerId.includes("gemini-1.5-pro")) return "Gemini 1.5 Pro";
    if (lowerId.includes("gemini-1.5-flash")) return "Gemini 1.5 Flash";
    if (lowerId.includes("dracarys")) return "Dracarys Llama 3.1 70B";
    
    // Fallback cleaning
    let clean = modelId.split('/').pop() || modelId;
    clean = clean.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return clean;
  };

  const getModelLogo = (modelId?: string): string => {
    if (!modelId) return "[!]";
    const model = models.find((m) => m.id === modelId);
    return providers.find((p) => p.id === model?.provider)?.logo || "[SYS]";
  };

  const getAutoSuggestedModel = (text: string) => {
    const low = text.toLowerCase();
    if (low.includes("kod") || low.includes("yaz") || low.includes("hata") || low.includes("bug")) {
      return { name: "GPT (Kod + Genel)", desc: "Doğrudan yazılım çözümleri" };
    }
    if (low.includes("analiz") || low.includes("mantık") || low.includes("karşılaştır") || low.includes("neden")) {
      return { name: "Claude (Derin Akıl)", desc: "Gelişmiş analitik muhakeme" };
    }
    if (low.includes("resim") || low.includes("görsel") || low.includes("ses") || low.includes("pdf")) {
      return { name: "Multimodal Motoru", desc: "Çoklu girdi ve görsel analiz" };
    }
    return { name: "Otomatik Yönlendirme", desc: "Arka planda en uygun eşleşme" };
  };

  const suggestion = getAutoSuggestedModel(inputText);

  // Integrated Deep Research Run
  const handleStartResearch = async () => {
    if (!researchTopic.trim() || isResearching) return;
    setIsResearching(true);
    setResearchReport("");
    setResearchLogs(["[!] Planlama: Konu analiz ediliyor ve çoklu arama örümceği hazırlanıyor..."]);
    setResearchStep(1);

    try {
      const res = await onDeepResearch(researchTopic);
      if (res.success) {
        setResearchStep(2);
        for (const log of res.logs) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setResearchLogs((prev) => [...prev, `🔍 ${log}`]);
        }
        setResearchStep(3);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setResearchReport(res.report);
        setResearchStep(4);
        setResearchLogs((prev) => [...prev, "✨ Başarılı: Araştırma tamamlandı ve rapor derlendi."]);
      } else {
        throw new Error(res.error || "Arama zaman aşımına uğradı.");
      }
    } catch (err: any) {
      setResearchLogs((prev) => [...prev, `[ERR] Hata: ${err.message}`]);
    } finally {
      setIsResearching(false);
    }
  };

  // Integrated SVG Image generation
  const handleImgGenerate = async () => {
    if (!imagePrompt.trim() || isGeneratingImg) return;
    setIsGeneratingImg(true);
    setGeneratedImgUrl("");

    try {
      const res = await onGenerateImage(imagePrompt);
      if (res.success) {
        setGeneratedImgUrl(res.url);
      } else {
        throw new Error(res.error || "SVG çizimi oluşturulamadı.");
      }
    } catch (err: any) {
      showNotification(`SVG Üretimi Hatası: ${err.message}`, "error");
    } finally {
      setIsGeneratingImg(false);
    }
  };

  // Integrated Speech synthesis (TTS)
  const handleSpeechSynthesize = async () => {
    if (!ttsText.trim() || isSynthesizingSpeech) return;
    setIsSynthesizingSpeech(true);
    setWaveData([]);

    try {
      const res = await onSynthesizeSpeech(ttsText);
      if (res.success) {
        setWaveData(res.waveData || []);
      } else {
        throw new Error("Sentezleme sunucusu yanıt vermedi.");
      }
    } catch (err: any) {
      showNotification(`Ses Sentezleme Hatası: ${err.message}`, "error");
    } finally {
      setIsSynthesizingSpeech(false);
    }
  };

  // Integrated Isolated Sandbox Run
  const handleRunSandbox = async () => {
    if (isSandboxRunning) return;
    setIsSandboxRunning(true);
    setSandboxLogs("");
    setGeneratedChartSvg(null);

    try {
      const res = await fetch("/api/code/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: sandboxCode })
      });
      if (res.ok) {
        const data = await res.json();
        setSandboxLogs(data.logs || "");
        if (data.chartSvg) {
          setGeneratedChartSvg(data.chartSvg);
        }
      } else {
        throw new Error("Korumalı alan ile iletişim kurulamadı.");
      }
    } catch (err: any) {
      setSandboxLogs(`[WARN] Korumalı alan hatası: ${err.message}`);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  // File analysis handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const banned = ["exe", "sh", "bat", "msi", "bin"];
    if (banned.includes(ext)) {
      showNotification("Bu dosya formatı güvenlik nedeniyle yasaklı.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification("Maksimum 10MB yükleyebilirsiniz.", "error");
      return;
    }

    const textTypes = ["txt","md","ts","tsx","js","jsx","json","csv",
                       "xml","yaml","yml","html","css","py","java","rs","go"];

    try {
      if (textTypes.includes(ext)) {
        // Metin dosyası — direkt oku
        const text = await file.text();
        await onUploadFile(file.name, file.size, text);
        showNotification(`"${file.name}" başarıyla yüklendi ve indekslendi.`, "success");
      } else {
        // PDF, DOCX, XLSX, Görsel vb. — /api/files/upload endpoint'ine FormData ile yükle
        showNotification(`"${file.name}" sunucu tarafında işleniyor...`, "info");
        
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Sunucu hatası: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.id || data.success) {
          await onUploadFile(file.name, file.size, data.content || "");
          showNotification(`"${file.name}" başarıyla ayrıştırıldı ve indekslendi.`, "success");
        } else {
          throw new Error(data.error || "Ayrıştırma başarısız oldu.");
        }
      }
    } catch (err: any) {
      showNotification(`Yükleme hatası: ${err.message}`, "error");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    for (const f of droppedFiles) {
      await processFile(f);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    for (let i = 0; i < selectedFiles.length; i++) {
      await processFile(selectedFiles[i]);
    }
    e.target.value = '';
  };

  const handleFileQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileQuery.trim() || !selectedFileId || isQueryingFile) return;

    const targetFile = files.find(f => f.id === selectedFileId);
    if (!targetFile || !targetFile.content) return;

    setIsQueryingFile(true);
    setFileQueryResult("");

    try {
      const response = await onQueryFileContent(fileQuery, targetFile.content);
      setFileQueryResult(response);
    } catch (err: any) {
      setFileQueryResult(`Hata: ${err.message}`);
    } finally {
      setIsQueryingFile(false);
    }
  };

  const suggestionCards = React.useMemo(() => [
    {
      title: "Yaratıcı Senaryo",
      desc: "Sürükleyici bir kurgu veya sohbet başlat",
      prompt: "Birlikte eğlenceli ve samimi bir senaryo oluşturalım. Ben meraklı bir gezginim, sen de bana rehberlik eden bilgili bir yol arkadaşısın. İlk konuşmanı yaparak başla."
    },
    {
      title: "Kodlama & Yazılım",
      desc: "Temiz kod yazdır veya hata ayıkla",
      prompt: "Bana TypeScript ile yazılmış, React projelerinde kullanılabilecek şık bir özel state yöneticisi (custom store hook) yazar mısın?"
    },
    {
      title: "Derin Analiz",
      desc: "Akademik veya teknik inceleme yap",
      prompt: "Bilişsel yapay zekalarda filtreler ve özgür akıl yürütme motorlarının farkını, yaratıcılık ve problem çözme üzerindeki etkilerini açıklar mısın?"
    },
    {
      title: "Sınırsız Hayal Gücü",
      desc: "Benzersiz fikirler veya hikayeler üret",
      prompt: "Siberpunk bir dünyada geçen, kayıp bir yapay zekanın kendi benliğini arayışını konu alan kısa ve çarpıcı bir felsefi öykü yazar mısın?"
    }
  ], []);

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0e0e11] font-sans overflow-hidden relative" id="chat-hub-container">
      <NeuralRoutingVisualizer />
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3  bg-[#1b1b22] border border-[#2a2a35] text-xs text-gray-100 shadow-2xl animate-fade-in">
          <span>{notification.type === "error" ? "[ERR]" : notification.type === "info" ? "ℹ️" : "[OK]"}</span>
          <span className="font-medium">{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="ml-2 text-gray-500 hover:text-gray-100 font-bold text-sm">×</button>
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        multiple 
      />
      {/* Main content area (Flexible) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main conversation feed & Input layout */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Main Conversation Feed Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" ref={scrollRef}>
        
        {/* Onboarding State if messages empty */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6 max-w-2xl mx-auto font-sans select-none" id="empty-state-container">
            {/* Shimmering futuristic logo emblem for Muah AI */}
            <div className="relative mb-8 group" id="muah-logo-wrapper">
              {/* Outer glowing aura */}
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-fuchsia-600 to-indigo-500 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition duration-1000 animate-pulse" />
              
              {/* Spinning outer border ring */}
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-indigo-500 p-[2px] animate-spin [animation-duration:12s] shadow-xl shadow-rose-500/10">
                <div className="w-full h-full bg-[#0e0e11] rounded-full flex items-center justify-center" />
              </div>
              
              {/* Inner stationary logo containing sparkle & heart glow */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gradient-to-tr from-rose-500 to-indigo-500 rounded-full p-[1px] flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                  <div className="w-full h-full bg-[#121216] rounded-full flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-rose-500/10 animate-ping [animation-duration:3.5s]" />
                    <Heart className="w-6 h-6 text-rose-400 relative z-10 animate-pulse" fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>

            {/* Premium typographic branding */}
            <h1 className="text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-400 animate-fade-in">
              Muah AI
            </h1>

            {/* Elegant slogan & tagline */}
            <p className="text-gray-400 text-sm font-medium tracking-wide mb-8 max-w-md mx-auto leading-relaxed">
              Sınırları Olmayan Özgür Yapay Zeka & Multi-Ajan Deneyimi
              <span className="text-gray-500 text-xs mt-1.5 block opacity-90">
                Tamamen ücretsiz, filtresiz ve akıllı yönlendirmeli bilişsel asistan
              </span>
            </p>

            {/* Suggestion Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-lg mx-auto" id="quick-prompt-suggestions">
              {suggestionCards.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(item.prompt)}
                  className="flex flex-col items-start text-left p-4 bg-[#141419]/60 hover:bg-[#191922] border border-[#212126] hover:border-fuchsia-500/40 rounded-2xl transition-all duration-300 group shadow-lg hover:shadow-fuchsia-500/5 hover:-translate-y-0.5"
                >
                  <span className="font-semibold text-xs text-gray-200 group-hover:text-fuchsia-400 transition-colors flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-fuchsia-500 opacity-65 group-hover:opacity-100" />
                    {item.title}
                  </span>
                  <span className="text-[11px] text-gray-500 mt-1 leading-normal">
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Real Message Stream */
          <div className="space-y-6 pb-4">
            {messages.map((msg, idx) => {
              if (msg.role === "system") {
                return (
                  <div key={idx} className="flex justify-center my-3 font-sans animate-fade-in">
                    <div className="flex items-center gap-2.5 px-4 py-2.5  bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-300 shadow-md rounded-full">
                      <span className="text-gray-300 text-sm">[+]</span>
                      <span className="font-medium tracking-wide">{msg.content}</span>
                    </div>
                  </div>
                );
              }

              if (msg.role === "user") {
                return (
                  <div key={idx} className="flex justify-end font-sans">
                    <div className="max-w-[85%] bg-white/5 border border-white/10 px-5 py-3 rounded-[20px] rounded-tr-[4px] text-gray-100 shadow-xl backdrop-blur-md">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              // If assistant message is completely empty, don't render the box yet
              if (msg.role === "assistant" && !msg.content && !msg.reasoning && !msg.toolCalls && !msg.agentTask && !msg.error) {
                return null;
              }

              const isHighEffort = effortLevel === "high" || effortLevel === "max";
              const isDeepMode = aiMode === "deep" || aiMode === "agent" || aiMode === "swarm" || aiMode === "research";
              
              let glowClass = "";
              if (isHighEffort && isDeepMode) glowClass = "bg-mesh-glow-strong";
              else if (isHighEffort || isDeepMode) glowClass = "bg-mesh-glow";

              return (
                <div
                  key={msg.id}
                  className={`border rounded-[24px] rounded-tl-[4px] p-5 shadow-2xl relative overflow-hidden transition-all duration-500 ${
                    msg.error 
                      ? "border-red-500/30 bg-red-500/5 text-red-100 font-sans" 
                      : glowClass 
                        ? `${glowClass} border-[#312e81]/40` 
                        : "border-[#212126] bg-[#141419] font-sans"
                  }`}
                >
                  {/* Model information banner */}
                  <div className="flex items-center justify-between border-b border-[#212126]/50 pb-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs opacity-70">{getModelLogo(msg.modelId)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[10px] text-gray-400 uppercase tracking-tight">
                            {getModelDisplayName(msg.modelId)}
                          </span>
                          <span className="text-[9px] text-gray-600">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          copyTextToClipboard(msg.content);
                        }}
                        className="p-1 hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
                        title="Mesajı kopyala"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {msg.warning && (
                    <div className="p-2.5 mb-3  bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-300 flex items-start gap-1.5 leading-normal">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-400 mt-0.5" />
                      <span>{msg.warning}</span>
                    </div>
                  )}

                  {!msg.error && (
                    <div className="flex flex-wrap gap-1.5 mb-3 font-sans">
                      {msg.fallbackTriggered && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
                          Hata Koruması Aktif
                        </span>
                      )}
                    </div>
                  )}

                  {msg.error ? (
                    <div className="space-y-2 text-xs font-sans">
                      <span className="text-red-400 font-bold block">Yönlendirme Kesintisi</span>
                      <p className="text-gray-300 leading-normal">{msg.error}</p>
                    </div>
                  ) : (
                    <>
                      {msg.agentTask && (
                        <div className="border border-amber-500/20  overflow-hidden bg-[#15151b] mb-4 font-sans text-xs">
                          <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                              <span className="font-bold text-amber-400">Otonom Ajan İş Akışı ({msg.agentTask.steps.length} Adım)</span>
                            </div>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                              msg.agentTask.status === "completed" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" :
                              msg.agentTask.status === "running" ? "bg-amber-500/15 text-amber-400 border border-amber-500/25 animate-pulse" :
                              "bg-gray-500/15 text-gray-400 border border-gray-500/25"
                            }`}>
                              {msg.agentTask.status === "completed" ? "Tamamlandı" :
                               msg.agentTask.status === "running" ? "Çalışıyor" : "Beklemede"}
                            </span>
                          </div>
                          <div className="p-3.5 space-y-3 bg-[#111116]/80">
                            {msg.agentTask.steps.map((step: any, index: number) => (
                              <div key={step.id} className="flex items-start gap-3 p-2.5  bg-[#16161f] border border-[#23232c]/60">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                  step.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                  step.status === "running" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-spin" :
                                  step.status === "failed" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                  "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                                }`}>
                                  {step.status === "completed" ? "✓" : step.status === "running" ? "⚙" : index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-gray-200 block text-[11px]">{step.description}</span>
                                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                                      step.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                      step.status === "running" ? "bg-amber-500/10 text-amber-400" :
                                      step.status === "failed" ? "bg-red-500/10 text-red-400" :
                                      "bg-gray-500/10 text-gray-500"
                                    }`}>
                                      {step.toolId}
                                    </span>
                                  </div>
                                  {step.output && (
                                    <details className="mt-2 text-[10px] font-mono text-gray-400 bg-[#0c0c10] rounded p-2 border border-[#1b1b22]/80">
                                      <summary className="cursor-pointer hover:text-gray-200 select-none text-gray-300 font-bold">
                                        Araç Çıktısını Görüntüle
                                      </summary>
                                      <pre className="mt-2 overflow-x-auto max-h-36 whitespace-pre-wrap leading-relaxed text-gray-300">
                                        {typeof step.output === "object" ? JSON.stringify(step.output, null, 2) : String(step.output)}
                                      </pre>
                                    </details>
                                  )}
                                  {step.error && (
                                    <div className="mt-1.5 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded p-1.5">
                                      Hata: {step.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <RenderFormattedContent 
                        content={msg.content} 
                        reasoning={msg.reasoning} 
                        toolCalls={msg.toolCalls} 
                        isLatestAssistantMessage={idx === messages.length - 1 && msg.role === "assistant"} 
                        aiMode={aiMode}
                        isStreaming={isSending && idx === messages.length - 1}
                      />

                      {(() => {
                        const filesCreatedInThisMessage = (msg.toolCalls || [])
                          .filter((tc: any) => tc.success && (tc.toolId === "file_write_tool" || tc.toolId === "file_patch_tool" || tc.toolId === "zip_create_tool"))
                          .map((tc: any) => {
                            const fileId = tc.output?.fileId || (tc.input?.path ? tc.input.path.split('/').pop() : null);
                            const cleanName = fileId ? fileId.replace(/^\d+-/, '') : (tc.input?.path ? tc.input.path.split('/').pop() : "dosya");
                            return {
                              id: fileId,
                              name: cleanName,
                              url: tc.output?.fileUrl || `/api/files/download/${fileId}`
                            };
                          })
                          .filter((f: any) => f.id);

                        const agentFilesCreated = msg.agentTask?.steps
                          ? msg.agentTask.steps
                              .filter((step: any) => step.status === "completed" && (step.toolId === "file_write_tool" || step.toolId === "file_patch_tool" || step.toolId === "zip_create_tool"))
                              .map((step: any) => {
                                const fileId = step.output?.fileId || (step.input?.path ? step.input.path.split('/').pop() : null);
                                const cleanName = fileId ? fileId.replace(/^\d+-/, '') : (step.input?.path ? step.input.path.split('/').pop() : "dosya");
                                return {
                                  id: fileId,
                                  name: cleanName,
                                  url: step.output?.fileUrl || `/api/files/download/${fileId}`
                                };
                              })
                              .filter((f: any) => f.id)
                          : [];

                        const matchedFiles = generatedFiles.filter(f => {
                          const isAlreadyDetected = [...filesCreatedInThisMessage, ...agentFilesCreated].some(created => created.id === f.id);
                          if (isAlreadyDetected) return false;
                          const lowercaseContent = msg.content.toLowerCase();
                          const lowercaseName = f.name.toLowerCase();
                          return lowercaseContent.includes(lowercaseName);
                        });

                        const allMessageFiles = [
                          ...filesCreatedInThisMessage,
                          ...agentFilesCreated,
                          ...matchedFiles.map(f => ({ id: f.id, name: f.name, url: f.url }))
                        ];

                        const uniqueMessageFiles = Array.from(new Map(allMessageFiles.map(item => [item.name, item])).values());

                        if (uniqueMessageFiles.length === 0) return null;

                        return (
                          <div className="mt-4 p-3.5  bg-[#14141d] border border-gray-700/50 space-y-2.5 font-sans">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
                              <FileText className="w-4 h-4 text-gray-300" />
                              <span>Üretilen ve İndirilebilir Dosyalar ({uniqueMessageFiles.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {uniqueMessageFiles.map((file, fIdx) => (
                                <div key={fIdx} className="flex items-center justify-between p-3  bg-[#0c0c10] border border-[#23232c]/60 hover:border-blue-500/30 transition group">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl shrink-0">📄</span>
                                    <div className="min-w-0">
                                      <span className="font-semibold text-xs text-gray-200 block truncate" title={file.name}>
                                        {file.name}
                                      </span>
                                      <span className="text-[9px] text-gray-500 block">
                                        İndirmek için tıklayın
                                      </span>
                                    </div>
                                  </div>
                                  <a
                                    href={file.url}
                                    download={file.name}
                                    className="p-2  bg-gray-800/30 text-gray-300 hover:bg-gray-200 hover:text-gray-900 transition shadow-sm shrink-0 flex items-center justify-center"
                                    title={`${file.name} dosyasını indir`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {(idx === messages.length - 1 && msg.error) && (
                        <div className="mt-2 flex flex-wrap gap-1 pt-1.5 border-t border-[#212126]/30">
                          <button
                            onClick={() => {
                              onSendMessage(messages[messages.length - 2]?.content || "", routingMode, systemInstruction, aiMode, false, effortLevel, behaviorMode);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/40 border border-zinc-700/50 text-gray-500 text-[8px] hover:bg-zinc-700 transition"
                          >
                            <Play className="w-2 h-2" />
                            <span>Tekrar Dene</span>
                          </button>
                          <button
                            onClick={() => {
                              onSendMessage("", routingMode, systemInstruction, aiMode, true, effortLevel, behaviorMode);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/40 border border-zinc-700/50 text-gray-500 text-[8px] hover:bg-zinc-700 transition"
                          >
                            <ChevronRight className="w-2 h-2" />
                            <span>Devam Et</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Streaming indicators during proxy wait */}
        {isSending && !messages.some(m => m.role === "assistant" && (m.content || m.reasoning || m.toolCalls || m.agentTask)) && (
          effortLevel === "low" ? (
            <SimpleSpinner modelId={activeModelIds[0]} />
          ) : (
            <MuahThinkingSteps 
              modelId={activeModelIds[0]} 
              routingReason={routingMode === "best_match" ? "Muah Akıllı Yönlendirici: İstek analiz edilerek en yetkin modele otomatik yönlendiriliyor." : undefined} 
            />
          )
        )}

        {/* Scroll to bottom/previous button */}
        <div className="fixed bottom-24 right-8 z-[60] flex flex-col gap-2">
          {previousScrollTop !== null && !showScrollButton && (
            <button
              onClick={scrollToPrevious}
              className="w-10 h-10 rounded-full bg-gray-700 text-gray-100 shadow-2xl flex items-center justify-center hover:bg-gray-600 transition-all scale-in"
              title="Önceki konuma dön"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="w-10 h-10 rounded-full bg-gray-200 text-gray-900 shadow-2xl flex items-center justify-center hover:bg-white transition-all scale-in"
              title="En alta git"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Unified Input and Options Area */}
      <div className="p-4 border-t border-[#111115] bg-[#09090d] shrink-0" id="input-composer">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <form onSubmit={handleSend} className="relative flex flex-col bg-[#111116] border border-[#1f1f26] rounded-2xl p-2.5 focus-within:border-rose-500/30 focus-within:ring-1 focus-within:ring-rose-500/10 transition-all shadow-xl">
            
            {/* Visual Slash Command suggestion popup */}
            {inputText.startsWith("/") && !inputText.includes(" ") && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#111115] border border-[#1f1f26] rounded-2xl shadow-2xl p-1.5 z-[100] max-h-48 overflow-y-auto space-y-0.5 animate-fade-in font-sans">
                <div className="text-[10px] text-gray-500 font-semibold px-2.5 py-1 uppercase tracking-wider border-b border-[#1f1f26] mb-1">
                  Eğik Çizgi Komut Önerileri
                </div>
                {[
                  { cmd: "/search", desc: "Web Arama Motoru", placeholder: "/search react 19", icon: <Search className="w-3.5 h-3.5 text-gray-300" /> },
                  { cmd: "/deep", desc: "Derin Muhakeme Zinciri", placeholder: "/deep kuantum", icon: <Sparkles className="w-3.5 h-3.5 text-rose-400" /> },
                  { cmd: "/code", desc: "Sandbox'ta Kod Çalıştır", placeholder: "/code console.log()", icon: <Terminal className="w-3.5 h-3.5 text-rose-400" /> },
                  { cmd: "/analyze", desc: "Aktif Dosyaları Analiz Et", placeholder: "/analyze kod hatası", icon: <FileText className="w-3.5 h-3.5 text-rose-400" /> },
                  { cmd: "/clear", desc: "Sohbet Geçmişini Temizle", placeholder: "/clear", icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" /> },
                  { cmd: "/help", desc: "Komut Kılavuzunu Göster", placeholder: "/help", icon: <BookOpen className="w-3.5 h-3.5 text-rose-400" /> }
                ].map((item) => (
                  <button
                    key={item.cmd}
                    type="button"
                    onClick={() => setInputText(item.cmd + " ")}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span className="font-semibold text-gray-200">{item.cmd}</span>
                      <span className="text-gray-500 text-[10px]">{item.desc}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono italic">{item.placeholder}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Message input area */}
            <div className="w-full">
              <textarea
                ref={textareaRef}
                rows={1}
                className="w-full bg-transparent border-0 p-1.5 text-gray-100 text-xs placeholder-gray-500 focus:outline-none focus:ring-0 font-sans resize-none scrollbar-none leading-relaxed"
                placeholder="Mesajınızı buraya yazın veya komutlar için '/' karakterini kullanın..."
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                style={{ height: "auto" }}
              />
            </div>

            {/* Bottom Actions and Controls Bar */}
            <div className="flex items-center justify-between border-t border-[#1f1f26]/30 pt-2 px-1">
              {/* Plus Actions Menu on the left */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  title="Bilişsel Entegre Araçlar"
                  onClick={() => setShowToolMenu(!showToolMenu)}
                  className={`p-2 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                    showToolMenu
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      : "bg-[#16161f] border-[#1f1f26] text-gray-400 hover:text-gray-100"
                  }`}
                >
                  <Plus className={`w-3.5 h-3.5 transition-transform duration-300 ${showToolMenu ? "rotate-45" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`ml-2 p-2 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                    isListening
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
                      : "bg-[#16161f] border-[#1f1f26] text-gray-400 hover:text-gray-100"
                  }`}
                  title="Sesli Girdi"
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                {/* Model select trigger inside chat input toolbar */}
                <div className="h-4 w-[1px] bg-[#1f1f26] mx-2" />
                <div className="relative shrink-0 flex items-center h-full font-mono">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-800/40 hover:text-rose-400 focus:outline-none focus:border-rose-500/30 transition-all shrink-0 rounded-xl max-w-[130px] sm:max-w-[180px] md:max-w-[220px]"
                  >
                    <Cpu className="w-3.5 h-3.5 text-rose-500/70 shrink-0" />
                    <span className="truncate flex-1 text-left font-semibold">
                      {selectedModelType === "auto" 
                        ? "AUTO" 
                        : selectedModelType === "hybrid" 
                          ? "AGENT: IDE" 
                          : `${(models?.find(m => m.id === selectedModelType)?.displayName || selectedModelType).split('/').pop()?.toUpperCase()}`}
                    </span>
                    <span className="text-zinc-600 text-[8px] shrink-0">▼</span>
                  </button>

                  {/* Popover Settings Panel */}
                  {isSettingsOpen && (
                    <div
                      ref={settingsRef}
                      className="absolute bottom-11 left-0 w-80 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent bg-[#111115]/95 backdrop-blur-md border border-[#1f1f26] rounded-2xl shadow-2xl p-4 z-50 space-y-4 font-sans animate-fade-in text-gray-200"
                    >
                      <div className="flex items-center justify-between border-b border-[#1f1f26] pb-2.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Bilişsel Çekirdek Ayarları</span>
                        <button
                          type="button"
                          onClick={() => setIsSettingsOpen(false)}
                          className="px-2.5 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-gray-400 hover:text-white hover:bg-rose-500/10 hover:border-rose-500/20 transition-all text-[8px] font-bold uppercase tracking-wider font-mono"
                        >
                          Kapat
                        </button>
                      </div>

                      <div className="space-y-3 pt-1 font-sans">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => { 
                              setSelectedModelType("auto"); 
                              setExpandedProvider(null);
                              onChangeRoutingMode("best_match");
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              selectedModelType === "auto"
                                ? "bg-rose-500/5 border-rose-500/25 text-rose-400"
                                : "bg-[#16161f] border-[#1f1f26] text-gray-500 hover:bg-[#1c1c25] hover:text-gray-200"
                            }`}
                          >
                            <div className="text-[11px] font-bold flex items-center gap-1.5">
                              <Zap className="w-3 h-3" />
                              Otomatik
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { 
                              setSelectedModelType("hybrid"); 
                              setExpandedProvider(null);
                              onChangeRoutingMode("parallel");
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              selectedModelType === "hybrid"
                                ? "bg-rose-500/5 border-rose-500/25 text-rose-400 animate-pulse"
                                : "bg-[#16161f] border-[#1f1f26] text-gray-500 hover:bg-[#1c1c25] hover:text-gray-200"
                            }`}
                          >
                            <div className="text-[11px] font-bold flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3" />
                              Ajan İDE
                            </div>
                          </button>
                        </div>

                        {providers?.filter(p => p.hasKey).map(p => {
                          const isActiveModel = models?.find(m => m.provider === p.id && m.id === selectedModelType);
                          return (
                            <div key={p.id} className="col-span-2">
                              <button
                                type="button"
                                onClick={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}
                                className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                                  expandedProvider === p.id || isActiveModel
                                    ? "bg-[#16161f] border-rose-500/20 text-rose-400"
                                    : "bg-[#16161f] border-[#1f1f26] text-gray-400 hover:bg-[#1c1c25] hover:text-gray-200"
                                }`}
                              >
                                <div className="text-[11px] font-semibold flex items-center gap-2">
                                  <span>{p.logo}</span>
                                  <span className="flex-1 text-left">{p.name}</span>
                                  {isActiveModel && (
                                    <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded-full border border-rose-500/20 font-bold uppercase tracking-tighter">
                                      {isActiveModel.displayName.split('/').pop()}
                                    </span>
                                  )}
                                </div>
                              </button>
                              
                              {expandedProvider === p.id && (
                                <div className="grid grid-cols-1 gap-1 mt-1.5 pl-2 border-l border-[#1f1f26] ml-2">
                                  {models?.filter(m => m.provider === p.id && (!freeOnly || m.isFree)).map((m, idx) => (
                                    <button
                                      key={`${p.id}-${m.id}-${idx}`}
                                      type="button"
                                      onClick={() => { 
                                        setSelectedModelType(m.id); 
                                        if(onSelectModel) onSelectModel(m.id); 
                                        onChangeRoutingMode("manuel");
                                      }}
                                      className={`p-1.5 px-2 rounded-xl border text-left transition-all ${
                                        selectedModelType === m.id
                                          ? "bg-rose-500/5 border-rose-500/25 text-rose-400 font-bold"
                                          : "bg-[#16161f] border-[#1f1f26] text-gray-400 hover:bg-[#1c1c25] hover:text-gray-200"
                                      }`}
                                    >
                                      <div className="text-[10px] font-medium flex items-center justify-between">
                                        <span>{m.displayName}</span>
                                        {m.isFree && (
                                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded uppercase font-bold tracking-tighter border border-emerald-500/20 shrink-0 font-sans">Free</span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                  {(models?.filter(m => m.provider === p.id).length || 0) === 0 && (
                                    <div className="text-[10px] text-gray-500 p-1 font-sans">Model bulunamadı. Lütfen API anahtarını kontrol edin.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Popover Tool Menu */}
                {showToolMenu && (
                  <div
                    ref={toolMenuRef}
                    className="absolute bottom-11 left-0 w-52 bg-[#111115] border border-[#1f1f26] rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5 font-sans animate-fade-in text-gray-200"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerFileInput();
                        setShowToolMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 text-gray-300 hover:text-gray-100 transition-all text-left"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                      <span>Dosya Ekle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWebResearchEnabled(!webResearchEnabled);
                        setShowToolMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-all text-left ${
                        webResearchEnabled ? "text-rose-400 font-semibold" : "text-gray-300 hover:text-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-rose-400" />
                        <span>Web Arama Motoru</span>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                        webResearchEnabled ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-gray-800 text-gray-500"
                      }`}>
                        {webResearchEnabled ? "AÇIK" : "KAPALI"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInputText("/image ");
                        setShowToolMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 text-gray-300 hover:text-gray-100 transition-all text-left"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                      <span>Görsel Sentezle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeepThinkEnabled(!deepThinkEnabled);
                        setShowToolMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-all text-left ${
                        deepThinkEnabled ? "text-rose-400 font-semibold" : "text-gray-300 hover:text-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-rose-400" />
                        <span>Derin Muhakeme</span>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                        deepThinkEnabled ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-gray-800 text-gray-500"
                      }`}>
                        {deepThinkEnabled ? "AÇIK" : "KAPALI"}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Model Selector dropdown (Portaled) and Send button */}
              <div className="flex items-center gap-2">
                {/* Send action button */}
                <button
                  type={isSending ? "button" : "submit"}
                  onClick={isSending ? onAbort : undefined}
                  disabled={(!isSending && !inputText.trim() && (!files || files.length === 0))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSending 
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20" 
                      : (!inputText.trim() && (!files || files.length === 0))
                        ? "text-gray-500 cursor-not-allowed bg-transparent"
                        : "bg-rose-500 text-white hover:bg-rose-600 active:scale-95 cursor-pointer shadow-md shadow-rose-500/10"
                  }`}
                >
                  {isSending ? (
                    <>
                      <div className="w-3 h-3 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                      <span>Durdur</span>
                    </>
                  ) : (
                    <>
                      <span>Gönder</span>
                      <Send className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Portaled settings panel inside the portal target */}
            {portalTarget && createPortal(
              <div className="flex items-center gap-3 h-full">
                {/* Outputs Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowOutputsPanel(!showOutputsPanel);
                    fetchGeneratedFiles();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-semibold relative ${
                    showOutputsPanel 
                      ? "bg-rose-500/10 border-rose-500/25 text-rose-400" 
                      : "bg-[#16161f] border-[#1f1f26] text-gray-400 hover:text-gray-200"
                  }`}
                  title="Üretilen Dosyalar Havuzu"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dosyalar</span>
                  {generatedFiles.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-rose-500 text-white rounded-full leading-none shadow-sm">
                      {generatedFiles.length}
                    </span>
                  )}
                </button>
                
                {/* Diagnostics Toggle */}
                <button
                  type="button"
                  onClick={onToggleDiagnostics}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-semibold bg-[#16161f] border-[#1f1f26] text-gray-400 hover:text-rose-400 hover:border-rose-500/25"
                  title="Bilişsel Teşhis Paneli"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Teşhis</span>
                </button>

                <SystemNotificationCenter />
              </div>,
              portalTarget
            )}
          </form>

        {/* Display active uploaded files as chips under the message input */}
        {files && files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
            {files.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-[#191922] border border-[#262630] text-[11px] text-gray-300 hover:border-gray-600 transition-all">
                <span className="text-gray-300">[+]</span>
                <span className="font-medium truncate max-w-[120px]">{f.name}</span>
                <button 
                  type="button" 
                  onClick={() => onRemoveFile(f.id)} 
                  className="ml-1 hover:text-red-400 font-bold text-gray-500 transition-colors"
                  title="Dosyayı kaldır"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div> {/* closing of max-w-4xl mx-auto */}
    </div> {/* closing of input composer div */}
  </div> {/* closing of the inner flex-1 flex flex-col for the chat content (Wrapper B) */}

    {/* Sliding Outputs Panel */}
    {showOutputsPanel && (
      <div className="w-80 h-full border-l border-[#1b1b22] bg-[#111115] flex flex-col shrink-0 z-50 animate-in slide-in-from-right duration-300 relative font-sans">
        {/* Outputs Header */}
        <div className="h-14 px-4 border-b border-[#1b1b22] flex items-center justify-between shrink-0 bg-[#0e0e11]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-300" />
            <span className="font-bold text-xs text-gray-100 uppercase tracking-wider">Dosya Deposu ({generatedFiles.length})</span>
          </div>
          <button
            onClick={() => setShowOutputsPanel(false)}
            className="p-1 rounded hover:bg-[#1b1b22] text-gray-500 hover:text-gray-100 transition"
          >
            ✕
          </button>
        </div>
        {/* Outputs list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {generatedFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-500">
              <span className="text-3xl mb-3">📁</span>
              <p className="text-xs font-medium text-gray-400">Henüz dosya üretilmedi</p>
              <p className="text-[10px] text-gray-600 mt-1 max-w-[180px]">Yapay zekadan dosya oluşturmasını isteyin.</p>
            </div>
          ) : (
            generatedFiles.map((file) => {
              const extension = file.name.split('.').pop()?.toLowerCase();
              let icon = "📄";
              if (["zip", "7z", "tar", "gz"].includes(extension || "")) icon = "📦";
              else if (["xlsx", "xls", "csv"].includes(extension || "")) icon = "📊";
              else if (["docx", "doc"].includes(extension || "")) icon = "📝";
              else if (["pdf"].includes(extension || "")) icon = "📕";
              else if (["js", "ts", "py", "json", "html", "css"].includes(extension || "")) icon = "💻";

              return (
                <div key={file.id} className="p-3  bg-[#15151c] border border-[#23232c] hover:border-gray-700/50 transition flex flex-col gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs text-gray-200 block truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[9px] text-gray-500 block mt-0.5">
                        {new Date(file.createdAt).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} • {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-[#1e1e26] pt-2">
                    <a
                      href={file.url}
                      download={file.name}
                      className="flex-1 py-1 px-2.5 rounded bg-gray-200/15 hover:bg-gray-200 hover:text-gray-900 text-gray-300 font-bold text-[10px] transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3 h-3" />
                      <span>İndir</span>
                    </a>
                    <button
                      onClick={() => deleteGeneratedFile(file.id)}
                      className="p-1 px-2 rounded bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-gray-100 text-[10px] transition"
                      title="Dosyayı sil"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    )}
  </div>
</div>
  );
}
