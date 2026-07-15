import React from 'react';
import { motion } from 'motion/react';

interface ThinkingAnimationProps {
  status?: string;
  aiMode?: string;
}

export function ThinkingAnimation({ status, aiMode }: ThinkingAnimationProps) {
  const getStatusText = () => {
    if (status) return status;
    if (aiMode === "agent") return "Ajan Akıl Yürütüyor...";
    if (aiMode === "swarm") return "Swarm Ekibi Koordine Oluyor...";
    if (aiMode === "deep") return "Derin Düşünme Aktif...";
    return "Muah Yanıtı Akıtıyor...";
  };

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-rose-500/10 via-fuchsia-500/10 to-indigo-500/10 border border-fuchsia-500/25 rounded-full my-2 animate-fade-in select-none" id="muah-streaming-indicator">
      <div className="relative flex h-2.5 w-2.5">
        <motion.span 
          className="absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"
          animate={{ scale: [1, 2.5, 1], opacity: [0.75, 0, 0.75] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-r from-rose-400 to-fuchsia-500" />
      </div>
      <span className="text-[10px] font-extrabold tracking-widest text-fuchsia-400 uppercase font-sans animate-pulse">
        {getStatusText()}
      </span>
    </div>
  );
}
