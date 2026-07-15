import React, { useState } from "react";
import {
  Search,
  BookOpen,
  Compass,
  ExternalLink,
  Info,
  AlertTriangle,
  Globe,
  Clock
} from "lucide-react";
import { getApiKeys } from "../lib/encryption";

interface ResearchHubProps {
  onDeepResearch?: (topic: string) => Promise<any>;
}

export default function ResearchHub({ onDeepResearch }: ResearchHubProps = {}) {
  const [topic, setTopic] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; snippet: string }[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToMemory = async (text: string) => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        // Optional: show a toast or temporary success state
      }
    } catch (e) {
      console.error("Hafızaya kaydetme hatası:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkSave = async () => {
    if (searchResults.length === 0) return;
    const summary = `Araştırma Konusu: ${topic}\nBulgular:\n` + 
      searchResults.slice(0, 5).map((r, i) => `${i+1}. ${r.title}: ${r.snippet}`).join("\n");
    await handleSaveToMemory(summary);
  };

  const handleStartResearch = async () => {
    if (!topic.trim() || isResearching) return;
    setIsResearching(true);
    setSearchResults([]);
    setError(null);
    setLatency(null);
    const startTime = Date.now();

    try {
      const keysObj = getApiKeys();
      const apiKey = keysObj["openai"] || keysObj["anthropic"] || keysObj["google"] || "";
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "web_search_tool",
          input: { query: topic },
          apiKey
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Sunucu ${res.status} hata kodu döndürdü.`);
      }

      const data = await res.json();
      if (data.success) {
        setSearchResults(data.result || []);
        setLatency(Date.now() - startTime);
      } else {
        throw new Error(data.error || "Arama motorundan geçerli bir yanıt alınamadı.");
      }
    } catch (err: any) {
      setError(err.message || "Arama yürütülürken bilinmeyen bir hata oluştu.");
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090d] font-sans overflow-y-auto p-6 space-y-6" id="research-workspace">
      {/* Banner */}
      <div className="flex items-center justify-between border-b border-[#1f1f26] pb-5 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-white font-extrabold text-sm tracking-wide uppercase">
              GERÇEK ZAMANLI ARAŞTIRMA MOTORU
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              Canlı web kaynaklarını tarayın. Gerçek API ve arama bulgularını gecikmesiz listeleyin.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Control Panel */}
        <div className="space-y-4">
          <span className="text-zinc-500 text-[10px] font-bold tracking-widest block uppercase">
            Arama Denetimi
          </span>

          <div className="bg-[#111115] border border-[#1f1f26] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="space-y-2">
              <label className="text-zinc-400 text-[10px] block font-bold uppercase tracking-wider">
                Arama Sorgusu:
              </label>
              <textarea
                rows={3}
                className="w-full bg-[#16161f] border border-[#1f1f26] rounded-xl p-3.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 resize-none leading-relaxed transition-colors"
                placeholder="Örn: React 19 concurrent features..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isResearching}
              />
            </div>

            <button
              onClick={handleStartResearch}
              disabled={isResearching || !topic.trim()}
              className={`w-full py-2.5 rounded-xl text-white text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                isResearching || !topic.trim()
                  ? "bg-[#16161f] text-zinc-600 cursor-not-allowed border border-[#1f1f26]"
                  : "bg-gradient-to-r from-rose-500 to-fuchsia-600 hover:opacity-90 active:scale-95 cursor-pointer hover:shadow-rose-500/10"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isResearching ? "İnternet Aranıyor..." : "Aramayı Başlat"}</span>
            </button>

            <div className="p-4 rounded-xl bg-[#0c0c10]/40 border border-[#1f1f26] text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>
                Sistem, Tavily API teknolojisini kullanarak en güncel internet verilerini canlı olarak sorgular ve asistan hafızasıyla eşleştirir.
              </span>
            </div>
          </div>
        </div>

        {/* Right Search Results Output */}
        <div className="lg:col-span-2 space-y-4 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-[10px] font-bold tracking-widest block uppercase">
              Doğrulanmış Sonuçlar
            </span>
            {latency !== null && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 font-medium">
                <Clock className="w-3 h-3 text-zinc-500" />
                Gecikme: {latency}ms • {searchResults.length} Sonuç
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {/* Error Area */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-start gap-3 mb-4 animate-fade-in">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="text-rose-400 font-bold uppercase mb-0.5">Yürütme Hatası</h4>
                  <p className="text-zinc-400 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="flex-1 bg-[#111115] border border-[#1f1f26] rounded-2xl p-5 flex flex-col overflow-hidden shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1f1f26] pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-200">Canlı Bilgi Raporu</span>
                  {searchResults.length > 0 && (
                    <button
                      onClick={handleBulkSave}
                      disabled={isSaving}
                      className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <BookOpen className="w-2.5 h-2.5" />
                      {isSaving ? "Kaydediliyor..." : "Hafızaya Aktar"}
                    </button>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                    AKTİF VERİ
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 select-text pr-1">
                {isResearching ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-3 py-20">
                    <div className="relative flex h-8 w-8">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-8 w-8 bg-rose-500/20 border border-rose-500 flex items-center justify-center">
                        <Search className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                      </span>
                    </div>
                    <span className="text-xs font-medium text-zinc-400">Canlı arama dizinleri taranıyor, lütfen bekleyin...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-[#1f1f26]">
                    {searchResults.map((result, idx) => {
                      let domain = "web";
                      try {
                        domain = new URL(result.url).hostname;
                      } catch (e) {}

                      return (
                        <div key={idx} className="py-4.5 first:pt-0 last:pb-0 space-y-2 hover:bg-white/[0.01] px-2 transition-colors rounded-xl group">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/5 border border-rose-500/15 text-rose-400 text-[9px] font-mono flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5" />
                                {domain}
                              </span>
                              <button
                                onClick={() => handleSaveToMemory(`Kaynak: ${result.title}\nÖzet: ${result.snippet}\nLink: ${result.url}`)}
                                className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[8px] font-bold hover:text-emerald-400 transition-all cursor-pointer border border-zinc-700"
                                title="Bu sonucu hafızaya ekle"
                              >
                                HAFIZAYA EKLE
                              </button>
                            </div>
                            <a
                              href={result.url}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              rel="noreferrer"
                              className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                              title="Kaynağa Git"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          <a
                            href={result.url}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            rel="noreferrer"
                            className="text-gray-100 font-bold text-sm hover:text-rose-400 transition-colors block leading-snug"
                          >
                            {result.title}
                          </a>
                          <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap">
                            {result.snippet}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-24">
                    <BookOpen className="w-8 h-8 text-zinc-600 mb-3" />
                    <span className="text-xs font-medium text-zinc-500">Arama bulguları ve doğrulanmış makaleler burada listelenecektir.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
