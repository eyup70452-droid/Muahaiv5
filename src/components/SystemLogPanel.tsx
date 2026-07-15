
import React, { useEffect, useState, useRef } from "react";
import { Terminal, X, Trash2, Search, Filter, Copy, Check, ChevronDown } from "lucide-react";
import { logger, SystemLog } from "../core/utils/systemLogger";
import { copyTextToClipboard } from '../core/utils/clipboard';

interface SystemLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemLogPanel({ isOpen, onClose }: SystemLogPanelProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = logger.subscribe(setLogs);
    return unsubscribe;
  }, [isOpen]);

  const filteredLogs = logs.filter(log => {
    const matchesText = log.message.toLowerCase().includes(filter.toLowerCase()) || 
                       log.source.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesText && matchesLevel;
  });

  const copyErrors = async () => {
    const errorLogs = logs
      .filter(l => l.level === 'error')
      .map(l => `[${l.timestamp}] ERROR (${l.source}): ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`)
      .join('\n');
    
    if (!errorLogs) {
      alert("Kopyalanacak hata kaydı bulunamadı.");
      return;
    }

    await copyTextToClipboard(errorLogs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-end pointer-events-none sm:p-4">
      {/* Backdrop for mobile */}
      <div className="absolute inset-0 bg-black/40 sm:hidden pointer-events-auto" onClick={onClose} />
      
      <div className="w-full sm:max-w-xl bg-[#0d0d0f] border-t sm:border border-[#23232c] sm:rounded-xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-[85vh] pointer-events-auto animate-in slide-in-from-right-8 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#23232c] bg-[#121217]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-md">
              <Terminal className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest">Sistem Logları</h2>
              <p className="text-[9px] text-gray-500 font-mono hidden sm:block">Gerçek zamanlı sistem izleme</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={copyErrors}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition ${
                copied ? "bg-green-500/20 text-green-400" : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
              title="Hataları Kopyala"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span className="hidden xs:inline">HATALARI KOPYALA</span>
            </button>
            <button 
              onClick={() => logger.clear()}
              className="p-1.5 hover:bg-red-500/10 rounded-md text-gray-500 hover:text-red-400 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-md text-gray-400 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-[#23232c] bg-[#0d0d0f] flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-2.5" />
            <input 
              type="text" 
              placeholder="Filtrele..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-[#16161c] border border-[#23232c] rounded-md pl-8 pr-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <select 
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-[#16161c] border border-[#23232c] rounded-md px-2 py-1.5 text-xs text-gray-400 focus:outline-none w-full sm:w-auto"
          >
            <option value="all">Tüm Seviyeler</option>
            <option value="error">Hatalar</option>
            <option value="warn">Uyarılar</option>
            <option value="info">Bilgi</option>
            <option value="system">Sistem</option>
          </select>
        </div>

        {/* Log Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 font-mono text-[10px] sm:text-[11px] space-y-1 bg-black/40 no-scrollbar"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-gray-600 italic">
              Henüz log kaydı yok.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="group border-b border-white/[0.02] pb-1 hover:bg-white/[0.02] transition-colors">
                <div className="flex gap-1.5 sm:gap-2 items-start">
                  <span className="text-gray-600 shrink-0 select-none text-[8px] sm:text-[10px] mt-0.5">[{log.timestamp}]</span>
                  <span className={`uppercase font-black shrink-0 w-10 sm:w-12 text-center rounded-[2px] text-[8px] py-0.5 ${
                    log.level === 'error' ? 'text-red-500 bg-red-500/20' :
                    log.level === 'warn' ? 'text-amber-500 bg-amber-500/20' :
                    log.level === 'system' ? 'text-indigo-400 bg-indigo-500/20' :
                    'text-gray-400 bg-white/10'
                  }`}>
                    {log.level}
                  </span>
                  <span className={`flex-1 break-words leading-tight ${
                    log.level === 'error' ? 'text-red-300 font-medium' :
                    log.level === 'warn' ? 'text-amber-100/90' :
                    'text-gray-200'
                  }`}>
                    <span className="text-gray-500 font-bold mr-1 opacity-70">[{log.source}]</span>
                    {log.message}
                  </span>
                </div>
                {log.details && (
                   <details className="ml-4 sm:ml-24 mt-1 opacity-60 hover:opacity-100 transition-opacity">
                     <summary className="text-[9px] text-gray-500 cursor-pointer hover:text-indigo-400 uppercase tracking-tighter">Detaylar</summary>
                     <pre className="mt-1 p-2 bg-black/60 rounded border border-white/5 overflow-x-auto text-[9px] text-indigo-300/80 whitespace-pre-wrap max-h-40">
                       {JSON.stringify(log.details, null, 2)}
                     </pre>
                   </details>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1f1f26] bg-[#0c0c10]/40 flex items-center justify-between">
          <p className="text-[10px] text-gray-500 italic">Muah AI Günlük Dosyası</p>
          <button 
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-[10px] text-indigo-400/60 hover:text-indigo-400 uppercase font-bold"
          >
            Başa Dön
          </button>
        </div>
      </div>
    </div>
  );
}
