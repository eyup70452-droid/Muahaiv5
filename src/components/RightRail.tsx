import React from "react";
import {
  Brain,
  Clock,
  Settings,
  Trash2,
  X,
  Sparkles,
  Layers,
  Heart
} from "lucide-react";
import { ModelInfo, ChatSession } from "../types";

function MemoryManagerWidget() {
  const [facts, setFacts] = React.useState<Array<{text: string, timestamp: string}>>([]);
  const [newFact, setNewFact] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchMemory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        setFacts(data.facts || []);
      }
    } catch (e) {
      console.error("Failed to fetch memory in widget:", e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMemory();
  }, []);

  const handleAddMemory = async () => {
    if (!newFact.trim()) return;
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newFact.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setFacts(data.memory?.facts || []);
        setNewFact("");
      }
    } catch (e) {
      console.error("Failed to add memory in widget:", e);
    }
  };

  const handleDeleteMemory = async (textVal: string) => {
    try {
      const res = await fetch("/api/memory/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textVal })
      });
      if (res.ok) {
        const data = await res.json();
        setFacts(data.memory?.facts || []);
      }
    } catch (e) {
      console.error("Failed to delete memory in widget:", e);
    }
  };

  return (
    <div className="space-y-3 font-sans">
      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
        {isLoading ? (
          <div className="text-center py-4 text-zinc-600 text-[10px] animate-pulse">Yükleniyor...</div>
        ) : facts.length === 0 ? (
          <div className="text-center py-4 text-zinc-600 text-[10px] italic">Kaydedilmiş bir bilgi yok.</div>
        ) : (
          facts.map((f, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-[#141419] border border-[#1f1f26] text-[11px] hover:border-zinc-800 transition-colors">
              <span className="text-gray-300 leading-normal flex-1 pr-2 break-words">{f.text}</span>
              <button
                onClick={() => handleDeleteMemory(f.text)}
                className="text-zinc-600 hover:text-rose-400 p-1 transition-colors cursor-pointer shrink-0 border-0 bg-transparent"
                title="Hafızayı Sil"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-1.5 pt-2 border-t border-[#1f1f26]/50">
        <input
          type="text"
          placeholder="Yeni bilgi ekle..."
          className="flex-1 bg-[#141419] border border-[#1f1f26] px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-rose-500/50 font-sans transition-colors"
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddMemory();
          }}
        />
        <button
          onClick={handleAddMemory}
          disabled={!newFact.trim()}
          className="px-3 bg-[#1c1c24] hover:bg-rose-500 hover:text-white border border-[#1f1f26] hover:border-rose-500 text-gray-300 text-[10px] font-bold uppercase transition-all disabled:opacity-50 disabled:hover:bg-[#1c1c24] disabled:hover:text-gray-300 disabled:hover:border-[#1f1f26]"
        >
          Ekle
        </button>
      </div>
    </div>
  );
}

interface RightRailProps {
  session: ChatSession;
  sessions: ChatSession[];
  models: ModelInfo[];
  totalTokensUsed: number;
  isOpen?: boolean;
  onClose?: () => void;
  onSwitchSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

export default function RightRail({ 
  session, 
  sessions,
  models, 
  totalTokensUsed,
  isOpen = false,
  onClose,
  onSwitchSession,
  onDeleteSession
}: RightRailProps) {
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);

  const activeModels = models.filter((m) => session.activeModelIds.includes(m.id));

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        w-80 h-full bg-[#111115] border-l border-[#1f1f26] flex flex-col font-sans select-none
        fixed lg:static inset-y-0 right-0 z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `} id="right-rail-container" style={{ height: '100dvh' }}>
        
        {/* Panel Header */}
        <div className="p-5 border-b border-[#1f1f26] flex items-center justify-between shrink-0 bg-[#0c0c10]/40">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-gray-100 font-extrabold text-xs tracking-wider uppercase leading-none font-display">
                OTURUM AYARLARI
              </h2>
              <span className="text-gray-500 text-[8px] tracking-widest font-mono uppercase mt-1 block">
                BİLİŞSEL PARAMETRELER
              </span>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 hover:bg-[#1f1f26] text-gray-400 hover:text-white transition-all border-0 bg-transparent cursor-pointer"
              title="Paneli Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Active Model List (Replaces "Model Health" and other AI slop gauges) */}
          <div className="space-y-3">
            <span className="text-zinc-500 text-[9px] font-bold block tracking-widest uppercase font-mono">
              Aktif Bilişsel Modeller
            </span>

            <div className="space-y-2">
              {activeModels.length === 0 ? (
                <div className="p-3 bg-[#141419] border border-[#1f1f26] text-xs text-zinc-500 italic">
                  Aktif model seçilmedi.
                </div>
              ) : (
                activeModels.map((m) => (
                  <div key={m.id} className="p-3.5 bg-[#141419] border border-[#1f1f26] space-y-2.5 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-gray-100 block truncate font-display">
                          {m.displayName}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block mt-0.5">
                          {m.provider} • {m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}K` : "64K"} limit
                        </span>
                      </div>
                      <div className="h-1.5 w-1.5 bg-rose-500 shadow-md shadow-rose-500/20 shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cross-Session Memory Section */}
          <div className="space-y-3 pt-4 border-t border-[#1f1f26]/60">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[9px] font-bold block tracking-widest uppercase font-mono">
                Uzun Vadeli Hafıza
              </span>
              <Brain className="w-3.5 h-3.5 text-rose-400" />
            </div>

            <div className="bg-[#0c0c10]/40 border border-[#1f1f26] p-4 space-y-4">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Asistanın sizin hakkınızda öğrendiği detaylar sunucu tarafındaki kalıcı veritabanında saklanır.
              </p>
              <MemoryManagerWidget />
            </div>
          </div>

          {/* Sohbet Geçmişi */}
          <div className="space-y-3 pt-4 border-t border-[#1f1f26]/60">
            <span className="text-zinc-500 text-[9px] font-bold block tracking-widest uppercase font-mono">
              Son Sohbetler
            </span>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic px-2">Geçmiş sohbet bulunamadı.</p>
              ) : (
                sessions.slice(0, 10).map((s) => (
                  <div key={s.id} className="relative group">
                    <button
                      onClick={() => onSwitchSession?.(s.id)}
                      className={`w-full text-left p-3 border transition-all pr-10 cursor-pointer ${
                        s.id === session.id 
                          ? "bg-rose-500/5 border-rose-500/25" 
                          : "bg-[#141419] border-[#1f1f26] hover:bg-[#191922] hover:border-zinc-800"
                      }`}
                    >
                      <p className={`text-xs font-semibold truncate font-display ${s.id === session.id ? "text-rose-400" : "text-gray-300"}`}>
                        {s.name}
                      </p>
                      <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                    
                    {sessionToDelete === s.id ? (
                      <div className="absolute inset-0 bg-[#16161b] border border-rose-500/30 flex items-center justify-between px-3.5 z-10 animate-fade-in">
                        <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wide">SİLİNSİN Mİ?</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              onDeleteSession?.(s.id);
                              setSessionToDelete(null);
                            }}
                            className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-extrabold hover:bg-rose-500 transition-all cursor-pointer border-0"
                          >
                            EVET
                          </button>
                          <button
                            onClick={() => setSessionToDelete(null)}
                            className="px-2.5 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-extrabold hover:bg-zinc-700 transition-all cursor-pointer border-0"
                          >
                            HAYIR
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(s.id);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-[#1a1a23] cursor-pointer border-0 bg-transparent"
                        title="Sohbeti Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Panel Footer */}
        <div className="p-4 border-t border-[#1f1f26] shrink-0 bg-[#0c0c10]/20 flex items-center justify-between text-[10px] text-zinc-500">
          <span className="font-mono tracking-wider">MUAH COGNITION</span>
          <span className="flex items-center gap-1 text-rose-400 font-mono font-bold tracking-wider uppercase">
            <span className="h-1.5 w-1.5 bg-rose-400 animate-pulse" />
            STABLE
          </span>
        </div>

      </div>
    </>
  );
}

