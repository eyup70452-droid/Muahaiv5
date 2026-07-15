import React, { useState } from "react";
import {
  MessageSquare,
  Code,
  Search,
  Sparkles,
  Database,
  Shield,
  Key,
  CheckCircle2,
  Brain,
  XCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Cpu,
  AlertTriangle,
  Info,
  Activity,
  Clock,
  Terminal,
  Heart
} from "lucide-react";
import { ProviderInfo, ModelInfo, ProviderId, ChatSession } from "../types";

interface SidebarProps {
  activePanel: string;
  setActivePanel: (panel: string) => void;
  providers: ProviderInfo[];
  models: ModelInfo[];
  onToggleModel: (modelId: string) => void;
  onUpdateApiKey: (providerId: ProviderId, key: string) => void;
  onValidateKey: (providerId: ProviderId) => void;
  activeModelIds: string[];
  isOpen?: boolean;
  onClose?: () => void;
  sessions?: ChatSession[];
  activeSessionId?: string;
  onNewChat?: () => void;
  onSwitchSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onOpenCustomSettings?: () => void;
  onOpenLogs?: () => void;
}

export default function Sidebar({
  activePanel,
  setActivePanel,
  providers,
  models,
  onToggleModel,
  onUpdateApiKey,
  onValidateKey,
  activeModelIds,
  isOpen = false,
  onClose,
  sessions = [],
  activeSessionId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onOpenCustomSettings,
  onOpenLogs
}: SidebarProps) {
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const menuItems = [
    { id: "chat", label: "Sohbet", subtitle: "Bilişsel Sohbet Odası", icon: MessageSquare, category: "Bilişsel Odalar" },
    { id: "code", label: "Kodlama", subtitle: "Korumalı Kod Sandbox'ı", icon: Code, category: "Bilişsel Odalar" },
    { id: "data", label: "Veri Analizi", subtitle: "İndeksli Kod & Veri Havuzu", icon: Database, category: "Bilişsel Odalar" },
    { id: "media", label: "Medya Hub", subtitle: "SVG & Ses Sentezleyici", icon: Sparkles, category: "Bilişsel Odalar" },
    { id: "memory", label: "Hafıza", subtitle: "Bilişsel Bellek Yönetimi", icon: Brain, category: "Bilişsel Odalar" },
    { id: "providers", label: "Sağlayıcılar", subtitle: "API Anahtar Deposu", icon: Key, category: "Sistem ve Altyapı" }
  ];

  const categories = Array.from(new Set(menuItems.map(item => item.category)));

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
        w-80 h-full bg-[#0c0c10] border-r border-zinc-900/60 flex flex-col font-sans select-none
        fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `} id="sidebar-container" style={{ height: '100dvh' }}>
        
        {/* Brand Header */}
        <div className="p-6 border-b border-zinc-900/40 flex items-center justify-between shrink-0 bg-[#07070a]/30">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-zinc-900/80 border border-rose-500/10 flex items-center justify-center">
              <Heart className="w-3 h-3 text-rose-500/80" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-gray-200 font-bold text-[11px] tracking-[0.25em] uppercase leading-none font-mono">
                MUAH AI
              </h1>
              <span className="text-zinc-600 text-[8px] tracking-wider uppercase font-mono mt-1.5 block">
                CORE INTERACTION HUB
              </span>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors uppercase text-[9px] tracking-widest font-mono border-0 bg-transparent cursor-pointer"
              title="Paneli Kapat"
            >
              [ Kapat ]
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <div className="px-5 pt-5 pb-2 shrink-0">
          <button
            onClick={() => {
              if (onNewChat) onNewChat();
              if (onClose) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white font-semibold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-rose-600/5 font-mono cursor-pointer border-0"
          >
            <Plus className="w-3.5 h-3.5" />
            YENİ SOHBET BAŞLAT
          </button>
        </div>

        {/* Dynamic Navigation Menu */}
        <div className="p-5 flex-1 overflow-y-auto min-h-0 space-y-6 scrollbar-thin scrollbar-thumb-zinc-900 scrollbar-track-transparent">
          {categories.map((cat) => (
            <div key={cat} className="space-y-2">
              <div className="px-1 flex items-center justify-between">
                <span className="text-zinc-500 text-[9px] font-bold tracking-wider uppercase font-mono">
                  {cat}
                </span>
              </div>
              <div className="space-y-1">
                {menuItems.filter(item => item.category === cat).map((item) => {
                  const Icon = item.icon;
                  const isActive = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePanel(item.id);
                        if (onClose) onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-left border cursor-pointer ${
                        isActive
                          ? "bg-zinc-900/40 border-zinc-800/60 text-rose-400 font-semibold"
                          : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-rose-400" : "text-zinc-600"}`} />
                        <div>
                          <span className="text-xs block leading-none font-medium tracking-wide font-display">{item.label}</span>
                          <span className="text-[8px] text-zinc-500 font-mono block mt-1.5 uppercase tracking-wide">{item.subtitle}</span>
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-1 h-1 bg-rose-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Sohbet Geçmişi */}
          <div className="pt-4 border-t border-zinc-900/40 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-zinc-500 text-[9px] font-bold tracking-wider uppercase font-mono">
                SOHBET GEÇMİŞİ
              </span>
              <span className="text-[8px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-850 px-1.5 py-0.5">
                {sessions.length}
              </span>
            </div>
            
            <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-900 scrollbar-track-transparent">
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between p-2 transition-all border ${
                      isActive
                        ? "bg-zinc-900/40 border-zinc-800/60 text-rose-400 font-medium"
                        : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10"
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (onSwitchSession) onSwitchSession(s.id);
                        setActivePanel("chat");
                        if (onClose) onClose();
                      }}
                      className="flex-1 text-left truncate flex items-center gap-2 cursor-pointer border-0 bg-transparent"
                    >
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-rose-400" : "text-zinc-600"}`} />
                      <span className="text-xs truncate font-display">{s.name || "Yeni Sohbet"}</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteSession) onDeleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0 border-0 bg-transparent cursor-pointer"
                      title="Sohbeti Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <div className="text-center py-4 text-[10px] text-zinc-600 italic">
                  Henüz sohbet geçmişi yok.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-900/40 shrink-0 bg-[#07070a]/10 font-mono">
          <div className="flex items-center justify-between px-1">
            <span className="text-[8px] text-zinc-600 tracking-wider uppercase">Muah Engine v1.2</span>
            <span className="text-[8px] text-zinc-500 uppercase tracking-widest">SECURE</span>
          </div>
        </div>
      </div>
    </>
  );
}

