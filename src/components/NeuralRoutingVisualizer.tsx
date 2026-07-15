import React, { useState, useEffect } from "react";
import { systemEvents } from "../core/utils/systemEvents";
import { Brain, Cpu, Zap, Activity, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function NeuralRoutingVisualizer() {
  const [lastRoute, setLastRoute] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = systemEvents.subscribe((event) => {
      if (event.type === "routing") {
        setLastRoute(event.data);
        setIsVisible(true);
        // Hide after 8 seconds
        setTimeout(() => setIsVisible(false), 8000);
      }
    });
    return unsubscribe;
  }, []);

  if (!lastRoute) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="absolute top-2 right-2 left-2 z-50 pointer-events-none"
        >
          <div className="max-w-md mx-auto bg-[#141419]/95 backdrop-blur-xl border border-rose-500/20 shadow-2xl shadow-rose-500/10 p-3 pointer-events-auto overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <Brain className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Sinirsel Yönlendirme</span>
                  <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded text-[9px] font-bold text-rose-300">
                    SKOR: {lastRoute.score}%
                  </div>
                </div>
                <h3 className="text-xs font-bold text-zinc-100 mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  {lastRoute.selectedModel.displayName}
                </h3>
                <p className="text-[10px] text-zinc-500 leading-relaxed font-sans mb-2">
                  {lastRoute.reason}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {lastRoute.fallbackModels.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] text-zinc-500">
                      <Zap className="w-2.5 h-2.5 text-zinc-700" />
                      {m.displayName}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setIsVisible(false)}
                className="p-1 text-zinc-600 hover:text-zinc-400"
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Visual pulse line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-rose-500/30 overflow-hidden">
              <motion.div 
                className="h-full bg-rose-500"
                initial={{ left: "-100%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ width: "30%", position: "absolute" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
