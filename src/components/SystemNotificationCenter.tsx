import React, { useState, useEffect } from "react";
import { systemEvents } from "../core/utils/systemEvents";
import { Bell, X, Info, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Notification {
  id: string;
  type: "info" | "success" | "warn" | "system";
  message: string;
  timestamp: string;
}

export default function SystemNotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = systemEvents.subscribe((event) => {
      const newNotif: Notification = {
        id: Math.random().toString(36).substr(2, 9),
        type: event.type === 'routing' ? 'system' : 'info',
        message: event.message,
        timestamp: event.timestamp
      };
      
      setNotifications(prev => [newNotif, ...prev].slice(0, 20));
      
      // Auto toast for certain types
      if (event.type === 'agent' || event.type === 'memory') {
        // Show as toast logic could go here
      }
    });
    return unsubscribe;
  }, []);

  const clearAll = () => setNotifications([]);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#111114]" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 max-h-[480px] bg-[#111116] border border-zinc-800 shadow-2xl rounded-xl z-50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#16161f]/50">
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Sistem Bildirimleri</span>
                </div>
                <button 
                  onClick={clearAll}
                  className="text-[9px] font-bold text-zinc-600 hover:text-zinc-400 uppercase tracking-tighter"
                >
                  TEMİZLE
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {notifications.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-700">
                    <Info className="w-8 h-8 opacity-10 mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Bildirim Yok</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className="p-3 bg-zinc-900/30 border border-zinc-800/40 rounded-lg hover:bg-zinc-900/50 transition-colors group"
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5">
                          {notif.type === 'system' ? <Zap className="w-3.5 h-3.5 text-rose-500" /> : <Info className="w-3.5 h-3.5 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{notif.message}</p>
                          <span className="text-[9px] text-zinc-600 font-mono mt-1 block">{notif.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-zinc-800 bg-[#0c0c10] flex justify-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest"
                >
                  KAPAT
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
