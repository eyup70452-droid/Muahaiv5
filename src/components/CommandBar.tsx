import React, { useState, useEffect, useRef } from "react";
import { Command, Search, Compass, Sparkles, Terminal, Trash2, Settings, Palette, Eye, ArrowUp, ArrowDown, Paperclip } from "lucide-react";
import { commandRegistry, Command as RegistryCommand, CommandContext } from "../core/commands/commandRegistry";

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  context: CommandContext;
}

export default function CommandBar({ isOpen, onClose, context }: CommandBarProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      const uploadedNames = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.success) {
          uploadedNames.push(files[i].name);
        }
      }
      
      if (uploadedNames.length > 0 && context.sendMessage) {
        context.sendMessage(`Dosyalar yüklendi: ${uploadedNames.join(", ")}`, "manuel", "", "fast");
      }
    } catch (err) {
      console.error("File upload failed:", err);
    }
  };

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keydown events globally when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, search, selectedIndex]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Filter commands
  const baseFiltered = commandRegistry.filter((cmd) => {
    const term = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(term) ||
      cmd.description.toLowerCase().includes(term) ||
      cmd.category.toLowerCase().includes(term)
    );
  });

  const filteredCommands = search.trim()
    ? [
        {
          id: "dynamic_run_agent",
          label: `🤖 '${search}' hedefini otonom ajan olarak çalıştır`,
          description: "Görevi analiz eden, planlayan ve araç zinciriyle çözen otonom yapay zeka ajanını başlatır.",
          category: "ai" as "navigation" | "ai" | "tools" | "system",
          action: (ctx: CommandContext) => {
            if (ctx.sendMessage) {
              ctx.sendMessage(search, "parallel", "", "agent");
            }
          }
        },
        ...baseFiltered
      ]
    : baseFiltered;

  const executeCommand = (cmd: any) => {
    cmd.action(context);
    onClose();
  };

  if (!isOpen) return null;

  // Map category to icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "navigation":
        return <Compass className="w-4 h-4 text-blue-400" />;
      case "ai":
        return <Sparkles className="w-4 h-4 text-violet-400" />;
      case "tools":
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case "system":
        return <Settings className="w-4 h-4 text-amber-400" />;
      default:
        return <Command className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "navigation":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "ai":
        return "bg-violet-500/10 text-violet-400 border-violet-500/20";
      case "tools":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "system":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-start justify-center pt-[15vh] px-4 font-sans select-none animate-fade-in">
      <div
        ref={containerRef}
        className="w-full max-w-2xl bg-[#141419] border border-[#262630]  shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[500px]"
      >
        {/* Search Input Box */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#22222b]">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 p-0 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-0 leading-relaxed font-sans"
            placeholder="Bir komut arayın veya eylemi tetikleyin... (Örn: 'Git', 'Ara')"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-[#2b2b36] rounded text-gray-400">
            <Paperclip className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[10px] bg-[#1d1d24] text-gray-400 border border-[#2b2b36] px-1.5 py-0.5 rounded font-mono">
              ESC
            </span>
          </div>
        </div>

        {/* Command List Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[340px] scrollbar-none">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3  cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-blue-600/10 border-blue-500/40 text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5  bg-[#191922] border border-[#282834]`}>
                      {getCategoryIcon(cmd.category)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block leading-none text-gray-200">
                        {cmd.label}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium block mt-1 truncate">
                        {cmd.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[8px] font-bold tracking-wider uppercase border px-1.5 py-0.5 rounded ${getCategoryBadgeColor(cmd.category)}`}>
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <span className="text-[10px] bg-[#1b1b22] text-gray-400 border border-[#2b2b36] px-1.5 py-0.5 rounded font-mono">
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10">
              <p className="text-xs text-gray-500 font-medium">Hiçbir komut eşleşmedi.</p>
            </div>
          )}
        </div>

        {/* Bottom Status / Navigation bar */}
        <div className="px-4 py-2 bg-[#0e0e12] border-t border-[#22222b] flex items-center justify-between text-[10px] text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              <span>Gezin</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-[#1b1b22] px-1 py-0.5 rounded border border-[#2b2b36]">↵</span>
              <span>Çalıştır</span>
            </span>
          </div>
          <div>
            <span>MUAH AI COMMAND CENTER</span>
          </div>
        </div>
      </div>
    </div>
  );
}
