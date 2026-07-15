import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Brain, 
  Zap, 
  Database, 
  Clock, 
  ShieldCheck,
  Server,
  Terminal,
  Cpu,
  Globe,
  Lock,
  Workflow
} from "lucide-react";
import { memoryStore } from "../core/memory/memoryStore";
import { logger } from "../core/utils/systemLogger";

export default function DiagnosticPanel() {
  const [stats, setStats] = useState({
    memoryCount: 0,
    lastLatency: 0,
    modelDist: {} as Record<string, number>,
    logs: [] as any[],
    uptime: "00:00:00",
    cpuUsage: 12,
    ramUsage: 450
  });

  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    
    const updateStats = () => {
      const memories = memoryStore.getMemories();
      const logs = logger.getLogs().slice(-15).reverse();
      const diff = Date.now() - startTime;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      
      // Calculate more realistic load
      const memoryLoad = Math.min(95, 20 + (memories.length * 2));
      
      setStats(prev => ({
        ...prev,
        memoryCount: memories.length,
        logs: logs,
        uptime: `${h}:${m}:${s}`,
        cpuUsage: Math.floor(Math.random() * 10) + (isThinking ? 40 : 5),
        ramUsage: 380 + (memories.length * 5) + Math.floor(Math.random() * 20)
      }));

      // Simulate thinking state based on logs
      const lastLog = logs[0];
      if (lastLog && (lastLog.message.includes("başlatıldı") || lastLog.message.includes("analiz"))) {
        setIsThinking(true);
        setTimeout(() => setIsThinking(false), 3000);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0c0c10] border-l border-zinc-900/60 font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-900/40 bg-[#07070a]/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className={`w-4 h-4 ${isThinking ? 'text-rose-500 animate-pulse' : 'text-rose-500'}`} />
          <h2 className="text-xs font-bold tracking-widest text-zinc-300 uppercase font-display">Bilişsel Teşhis</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono text-emerald-500/80">LIVE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Resource Monitor */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-zinc-900/20 border border-zinc-800/40 rounded-sm">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-3 h-3 text-fuchsia-400" />
                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-tight">Hafıza</span>
              </div>
              <div className="text-xl font-display font-bold text-zinc-100">{stats.memoryCount}</div>
              <div className="text-[9px] text-zinc-600 font-mono mt-1">AKTİF GERÇEK</div>
            </div>

            <div className="p-3 bg-zinc-900/20 border border-zinc-800/40 rounded-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-tight">Uptime</span>
              </div>
              <div className="text-xl font-display font-bold text-zinc-100 font-mono tracking-tighter text-xs mt-1.5">{stats.uptime}</div>
              <div className="text-[9px] text-zinc-600 font-mono mt-1 uppercase">SİSTEM SÜRESİ</div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-3 p-3 bg-zinc-900/10 border border-zinc-800/20 rounded-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                <span>CPU YÜKÜ</span>
                <span>{stats.cpuUsage}%</span>
              </div>
              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${stats.cpuUsage}%` }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                <span>RAM KULLANIMI</span>
                <span>{stats.ramUsage} MB</span>
              </div>
              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-fuchsia-500 transition-all duration-1000" style={{ width: `${(stats.ramUsage / 1024) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Network & Security */}
          <div className="space-y-2">
            <div className="p-2.5 bg-[#0e0e12] border border-zinc-800/20 rounded-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold text-zinc-400">GÜVENLİ TÜNEL</span>
              </div>
              <span className="text-[9px] text-emerald-500 font-mono">AKTİF</span>
            </div>
            <div className="p-2.5 bg-[#0e0e12] border border-zinc-800/20 rounded-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-bold text-zinc-400">BÖLGESEL DÜĞÜM</span>
              </div>
              <span className="text-[9px] text-blue-500 font-mono uppercase tracking-tighter">EU-WEST-3</span>
            </div>
          </div>
        </div>

        {/* Live Logs Section */}
        <div className="flex flex-col p-4 border-t border-zinc-900/40">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-3 h-3 text-zinc-600" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest font-mono">ETKİNLİK AKIŞI</span>
            </div>
            {isThinking && (
              <div className="flex items-center gap-1.5">
                <Workflow className="w-3 h-3 text-rose-500 animate-spin" />
                <span className="text-[8px] text-rose-500 font-bold animate-pulse">THINKING</span>
              </div>
            )}
          </div>
          
          <div className="bg-[#050507] border border-zinc-900/60 p-3 min-h-[200px] overflow-y-auto space-y-3 font-mono text-[10px]">
            {stats.logs.map((log, i) => (
              <div key={i} className="flex gap-2.5 items-start group">
                <span className="text-zinc-700 shrink-0 select-none">[{log.timestamp?.split(' ')[1] || '---'}]</span>
                <span className={`
                  ${log.level === 'error' ? 'text-rose-500' : log.level === 'warn' ? 'text-amber-500' : 'text-zinc-400'}
                  leading-tight
                `}>
                  <span className="font-bold mr-1.5 uppercase opacity-80">{log.level}:</span>
                  {log.message}
                </span>
              </div>
            ))}
            {stats.logs.length === 0 && (
              <div className="text-zinc-800 italic text-center py-10 uppercase tracking-tighter opacity-50">VERİ BEKLENİYOR...</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="p-4 bg-[#07070a]/50 border-t border-zinc-900/40 shrink-0">
        <div className="flex items-center justify-between text-[9px] text-zinc-600 font-mono tracking-tight">
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            <span>NODE-01 / MASTER</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            <span>v1.5.0-BETA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

