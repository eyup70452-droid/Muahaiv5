import React, { useState, useEffect } from "react";
import { Brain, Trash2, Plus, Tag, Calendar, Database, Search, Share2, List } from "lucide-react";
import { memoryStore, MemoryEntry } from "../core/memory/memoryStore";
import { motion, AnimatePresence } from "motion/react";
import CognitiveGraph from "./CognitiveGraph";

export default function MemoryManager() {
  const [memories, setMemories] = useState<MemoryEntry[]>(memoryStore.getMemories());
  const [newContent, setNewContent] = useState("");
  const [category, setCategory] = useState<MemoryEntry["category"]>("fact");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "graph">("list");

  useEffect(() => {
    return memoryStore.subscribe(() => {
      setMemories([...memoryStore.getMemories()]);
    });
  }, []);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    memoryStore.addMemory(newContent, category);
    setNewContent("");
  };

  const filteredMemories = memories.filter(m => 
    m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 p-6 font-sans overflow-hidden">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Brain className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Bilişsel Bellek Paneli</h1>
              <p className="text-xs text-zinc-500">AI OS'un uzun vadeli hafızasını yönetin.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              <button 
                onClick={() => setActiveTab("list")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${activeTab === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <List className="w-3.5 h-3.5" />
                LİSTE
              </button>
              <button 
                onClick={() => setActiveTab("graph")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${activeTab === 'graph' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Share2 className="w-3.5 h-3.5" />
                GRAFİK
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{memories.length} Kayıt</span>
            </div>
          </div>
        </div>

        {/* Dynamic Content */}
        {activeTab === "list" ? (
          <>
            {/* Input Area */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Hatırlanması gereken önemli bir bilgi, kural veya tercih girin..."
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 min-h-[100px] resize-none transition-all"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(["preference", "fact", "rule", "project"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        category === cat 
                          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                          : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:bg-zinc-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Belleğe İşle
                </button>
              </div>
            </div>

            {/* Search & List */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Bellekte ara..."
                  className="w-full bg-zinc-900/30 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-400 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {filteredMemories.map((memory) => (
                    <motion.div
                      key={memory.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 p-4 rounded-xl group transition-all"
                    >
                      <div className="flex justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded ${
                              memory.category === 'rule' ? 'bg-rose-500/10 text-rose-400' :
                              memory.category === 'preference' ? 'bg-amber-500/10 text-amber-400' :
                              memory.category === 'project' ? 'bg-cyan-500/10 text-cyan-400' :
                              'bg-indigo-500/10 text-indigo-400'
                            }`}>
                              {memory.category}
                            </span>
                            <div className="flex items-center gap-1.5 text-zinc-600">
                              <Calendar className="w-3 h-3" />
                              <span className="text-[10px] font-mono">{new Date(memory.timestamp).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed font-sans">{memory.content}</p>
                        </div>
                        <button
                          onClick={() => memoryStore.removeMemory(memory.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all self-start"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredMemories.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
                    <Brain className="w-12 h-12 opacity-20" />
                    <p className="text-sm font-medium italic">Hafızada eşleşen kayıt bulunamadı.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0">
            <CognitiveGraph />
          </div>
        )}
      </div>
    </div>
  );
}

