import React, { useState, useRef } from "react";
import {
  FileText,
  Upload,
  AlertTriangle,
  FolderOpen,
  Database,
  Trash2,
  Play,
  Brain,
  Layers,
  Terminal,
  BarChart2
} from "lucide-react";
import { FileMetadata } from "../types";

interface DataAnalyzerProps {
  files: FileMetadata[];
  onUploadFile: (name: string, size: number, content: string) => Promise<void>;
  onRemoveFile: (id: string) => void;
  onQueryFileContent: (query: string, fileContents: string) => Promise<string>;
}

export default function DataAnalyzer({
  files,
  onUploadFile,
  onRemoveFile,
  onQueryFileContent
}: DataAnalyzerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{ type: "error" | "info" | "success"; message: string } | null>(null);

  const showNotification = (message: string, type: "error" | "info" | "success" = "error") => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [activeQueryFile, setActiveQueryFile] = useState<string | null>(null);
  
  const [fileQuery, setFileQuery] = useState("");
  const [queryResult, setQueryResult] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified File Analysis & Structural Insights state
  const [activeTab, setActiveTab] = useState<"query" | "insights">("query");
  const [fileAnalysisMap, setFileAnalysisMap] = useState<Record<string, {
    summary: string;
    insights: string[];
    stats: any;
  }>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Sandbox properties
  const [sandboxCode, setSandboxCode] = useState(`// Enforce isolated memory limits
const data = [10, 20, 35, 50, 80, 110];
const doubleSum = data.map(x => x * 2).reduce((a, b) => a + b, 0);
console.log("Memory Buffer Enforced. Sum of doubled items:", doubleSum);`);
  const [sandboxLogs, setSandboxLogs] = useState("");
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [generatedChartSvg, setGeneratedChartSvg] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const bannedExts = ["exe", "sh", "bat", "msi", "dll", "bin"];
    if (bannedExts.includes(fileExt || "")) {
      showNotification(`Güvenlik duvarı engeli: .${fileExt} uzantısı desteklenmiyor.`, "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showNotification(`Dosya boyutu 10MB sınırını aşamaz.`, "error");
      return;
    }

    setUploadStatus((prev) => ({ ...prev, [file.name]: "Dosya okunuyor..." }));
    setUploadProgress((prev) => ({ ...prev, [file.name]: 30 }));

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        
        setUploadStatus((prev) => ({ ...prev, [file.name]: "İçerik analiz ediliyor..." }));
        setUploadProgress((prev) => ({ ...prev, [file.name]: 60 }));

        try {
          const res = await fetch("/api/tool/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolId: "file_analysis_tool",
              input: { fileContent: text }
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.result) {
              setFileAnalysisMap((prev) => ({
                ...prev,
                [file.name]: data.result
              }));
            }
          }
        } catch (err) {
          console.error("File upload tool analysis failed:", err);
        }

        await onUploadFile(file.name, file.size, text);

        setUploadStatus((prev) => ({ ...prev, [file.name]: "Tamamlandı" }));
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      };

      reader.onerror = () => {
        throw new Error("Yerel dosya okuma hatası.");
      };

      reader.readAsText(file);

    } catch (err: any) {
      setUploadStatus((prev) => ({ ...prev, [file.name]: "Hata" }));
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
      showNotification(`Yükleme başarısız ${file.name}: ${err.message}`, "error");
    }
  };

  const handleFileClick = async (id: string, name: string, content?: string) => {
    setActiveQueryFile(id);
    if (content && !fileAnalysisMap[name]) {
      setIsAnalyzing(true);
      try {
        const res = await fetch("/api/tool/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolId: "file_analysis_tool",
            input: { fileContent: content }
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.result) {
            setFileAnalysisMap((prev) => ({
              ...prev,
              [name]: data.result
            }));
          }
        }
      } catch (err) {
        console.error("Failed to run file analysis tool on file click:", err);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    for (const f of droppedFiles) {
      await processFile(f);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    for (const f of selectedFiles) {
      await processFile(f);
    }
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleQueryFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileQuery.trim() || !activeQueryFile || isQuerying) return;

    const selectedFile = files.find((f) => f.id === activeQueryFile);
    if (!selectedFile || !selectedFile.content) return;

    setIsQuerying(true);
    setQueryResult("");

    try {
      const response = await onQueryFileContent(fileQuery, selectedFile.content);
      setQueryResult(response);
    } catch (err: any) {
      setQueryResult(`[WARN] Analiz Motoru Hatası: ${err.message}`);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleRunSandbox = async () => {
    if (isSandboxRunning) return;
    setIsSandboxRunning(true);
    setSandboxLogs("");
    setGeneratedChartSvg(null);

    try {
      const res = await fetch("/api/tool/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: "code_execution_tool",
          input: {
            code: sandboxCode,
            language: "javascript"
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          const { output, errors, chartSvg } = data.result;
          setSandboxLogs(errors ? `[WARN] Derleyici Hatası:\n${errors}` : output || "Yürütme tamamlandı.");
          if (chartSvg) {
            setGeneratedChartSvg(chartSvg);
          }
        } else {
          throw new Error(data.error || "Sandbox motoru hata döndürdü.");
        }
      } else {
        throw new Error("Sandbox sunucu bağlantı hatası.");
      }
    } catch (err: any) {
      setSandboxLogs(`[WARN] Sunucu Bağlantı Hatası: ${err.message}`);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090d] font-sans overflow-y-auto p-6 space-y-6 relative" id="data-analyzer-workspace">
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3 bg-[#111115] border border-[#1f1f26] rounded-2xl text-xs text-white shadow-2xl animate-fade-in">
          <span className="font-medium text-rose-400">{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="ml-2 text-zinc-500 hover:text-white font-bold text-sm">×</button>
        </div>
      )}

      {/* Tab Banner */}
      <div className="flex items-center justify-between border-b border-[#1f1f26] pb-5 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-white font-extrabold text-sm tracking-wide uppercase">
              BİLİŞSEL VERİ & DOSYA ANALİZÖRÜ
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              Dosyalar yükleyin, onları anlamsal indeksleme ile sorgulayın ve akıllı analizler çıkarın.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & File Queue left, query panel right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Drag & Drop space */}
        <div className="space-y-4">
          <span className="text-zinc-500 text-[10px] font-bold tracking-widest block uppercase">
            Dosya Yükleme Portu
          </span>

          {/* Drag area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerSelectFile}
            className={`h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer p-6 transition-all duration-200 ${
              isDragging
                ? "border-rose-500 bg-rose-500/5"
                : "border-[#1f1f26] bg-[#111115] hover:bg-[#16161f] hover:border-rose-500/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              multiple
            />
            <div className="w-10 h-10 rounded-full bg-[#16161f] border border-[#1f1f26] flex items-center justify-center text-rose-400 mb-3 shadow-sm">
              <Upload className="w-4 h-4" />
            </div>
            <h4 className="text-gray-200 font-bold text-xs">
              Dosyayı buraya sürükleyin veya göz atmak için tıklayın
            </h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-normal max-w-xs">
              Sınır: Dosya başına maks 10MB. Metin, CSV, JSON, MD ve kod dosyalarını destekler.
            </p>
          </div>

          {/* Active File list */}
          {files.length > 0 && (
            <div className="space-y-3 pt-1">
              <span className="text-zinc-500 text-[10px] font-bold block tracking-widest uppercase">
                İndekslenmiş Dosyalar
              </span>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                      activeQueryFile === f.id
                        ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-[#111115] border-[#1f1f26] hover:border-zinc-800"
                    }`}
                    onClick={() => handleFileClick(f.id, f.name, f.content)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-rose-400" />
                      <div>
                        <span className="text-xs font-bold text-gray-200 block truncate max-w-[180px]">
                          {f.name}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 block mt-0.5">
                          Boyut: {formatBytes(f.size)} • Satır: {f.lineCount || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                        OKUNDU
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFile(f.id);
                          if (activeQueryFile === f.id) {
                            setActiveQueryFile(files.filter(x => x.id !== f.id)[0]?.id || null);
                          }
                        }}
                        className="text-zinc-500 hover:text-rose-400 p-1.5 transition-colors"
                        title="Dosyayı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Smart Query Panel */}
        <div className="space-y-4 flex flex-col justify-between">
          <span className="text-zinc-500 text-[10px] font-bold tracking-widest block uppercase">
            Semantik Dosya Sorgulama
          </span>

          <div className="bg-[#111115] border border-[#1f1f26] rounded-2xl p-4 flex-1 flex flex-col justify-between min-h-[250px] shadow-xl">
            {activeQueryFile ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-[#1f1f26] pb-2">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-rose-400" />
                      Dosya: <span className="text-gray-200 font-bold">{files.find(f => f.id === activeQueryFile)?.name}</span>
                    </span>
                    <span className="text-rose-400 font-bold uppercase tracking-wider text-[9px]">Sorgu Aktif</span>
                  </div>

                  {/* Dual Tabs Header */}
                  <div className="flex border-b border-[#1f1f26]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("query")}
                      className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${
                        activeTab === "query"
                          ? "border-rose-500 text-rose-400"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Bilişsel Sorgu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("insights");
                        const selected = files.find(f => f.id === activeQueryFile);
                        if (selected) {
                          handleFileClick(selected.id, selected.name, selected.content);
                        }
                      }}
                      className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${
                        activeTab === "insights"
                          ? "border-rose-500 text-rose-400"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Yapay Zeka Analizleri
                    </button>
                  </div>
                </div>

                {activeTab === "query" ? (
                  <form onSubmit={handleQueryFile} className="space-y-4 flex-1 flex flex-col justify-between mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-[#16161f] border border-[#1f1f26] rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-colors"
                        placeholder="Dosya içeriği hakkında bir soru yazın..."
                        value={fileQuery}
                        onChange={(e) => setFileQuery(e.target.value)}
                        disabled={isQuerying}
                      />
                      <button
                        type="submit"
                        disabled={isQuerying || !fileQuery.trim()}
                        className="px-4 py-2 bg-gradient-to-r from-rose-500 to-fuchsia-600 rounded-xl text-white text-xs font-bold tracking-wider transition-all flex items-center gap-1.5"
                      >
                        <Play className="w-3 h-3" />
                        <span>Sorgula</span>
                      </button>
                    </div>

                    {/* Outcome Window */}
                    <div className="flex-1 border border-[#1f1f26] rounded-xl bg-[#0c0c10]/40 p-4 mt-2 overflow-y-auto max-h-40">
                      {isQuerying ? (
                        <div className="flex items-center gap-2 text-xs text-rose-400 font-medium">
                          <Brain className="w-4 h-4 animate-pulse" />
                          <span>Gemini dosya yapısını analiz ediyor...</span>
                        </div>
                      ) : queryResult ? (
                        <div className="space-y-2 select-text font-sans">
                          <span className="text-[10px] text-rose-400 font-bold block tracking-wider uppercase">
                            Analiz Çıktısı:
                          </span>
                          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {queryResult}
                          </p>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-center text-zinc-600 text-xs py-8">
                          <span>Sorgu sonuçları burada görüntülenecektir.</span>
                        </div>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex-1 border border-[#1f1f26] rounded-xl bg-[#0c0c10]/40 p-4 mt-2 overflow-y-auto max-h-56">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center p-6 text-rose-400 space-y-2">
                        <Brain className="w-8 h-8 animate-pulse" />
                        <span className="text-xs font-medium">Dosya semantik yapısı analiz ediliyor...</span>
                      </div>
                    ) : (() => {
                      const selected = files.find(f => f.id === activeQueryFile);
                      const analysis = selected ? fileAnalysisMap[selected.name] : null;
                      if (!analysis) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 text-xs py-8">
                            <span>Bu belge için henüz bir analiz kaydı oluşturulmadı.</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (selected) {
                                  handleFileClick(selected.id, selected.name, selected.content);
                                }
                              }}
                              className="mt-3 px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] uppercase font-bold transition-colors"
                            >
                              Analizi Başlat
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4 select-text font-sans">
                          <div>
                            <span className="text-[10px] text-rose-400 font-bold block tracking-wider uppercase mb-1">
                              ÖZET RAPORU:
                            </span>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {analysis.summary}
                            </p>
                          </div>

                          {analysis.insights && analysis.insights.length > 0 && (
                            <div>
                              <span className="text-[10px] text-fuchsia-400 font-bold block tracking-wider uppercase mb-1.5">
                                ÖNE ÇIKAN BULGULAR:
                              </span>
                              <ul className="space-y-1 text-xs text-zinc-300">
                                {analysis.insights.map((ins: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="text-fuchsia-400 mt-1">•</span>
                                    <span>{ins}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysis.stats && (
                            <div>
                              <span className="text-[10px] text-amber-400 font-bold block tracking-wider uppercase mb-1.5">
                                METRİKLER:
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(analysis.stats).map(([k, v]) => (
                                  <div key={k} className="bg-[#111115] border border-[#1f1f26] rounded-xl p-2.5 font-mono text-[10px]">
                                    <span className="text-zinc-500 capitalize">{k}:</span>
                                    <span className="text-zinc-300 ml-1.5 font-bold">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-sans">
                <FolderOpen className="w-10 h-10 text-zinc-600 mb-3" />
                <h5 className="text-gray-300 font-bold text-xs tracking-wider">
                  Dosya Seçilmedi
                </h5>
                <p className="text-[11px] text-zinc-500 max-w-xs mt-1.5 leading-normal">
                  Sol taraftan analiz etmek istediğiniz bir dosyayı seçin veya yeni bir dosya yükleyin.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real Sandbox & Interactive Chart Rendering Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Sandbox Editor & Console logs */}
        <div className="space-y-3">
          <span className="text-zinc-500 text-[10px] font-bold tracking-widest block uppercase">
            Kod Çalıştırma Laboratuvarı
          </span>

          <div className="bg-[#111115] border border-[#1f1f26] rounded-2xl p-5 flex flex-col space-y-4 shadow-xl">
            <textarea
              rows={4}
              className="w-full bg-[#16161f] border border-[#1f1f26] rounded-xl p-3 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-rose-500/40 leading-relaxed transition-colors"
              value={sandboxCode}
              onChange={(e) => setSandboxCode(e.target.value)}
              disabled={isSandboxRunning}
            />

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-mono">Güvenli Sandbox Çevre Hattı</span>
              <button
                onClick={handleRunSandbox}
                disabled={isSandboxRunning || !sandboxCode.trim()}
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-fuchsia-600 rounded-xl text-white text-xs font-bold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{isSandboxRunning ? "Çalışıyor..." : "Kodu Çalıştır"}</span>
              </button>
            </div>

            {/* Console logs */}
            <div className="h-28 bg-[#0c0c10] border border-[#1f1f26] rounded-xl p-3 overflow-y-auto">
              <span className="text-[9px] text-zinc-500 block tracking-wider uppercase border-b border-[#1f1f26] pb-1.5 mb-1.5 font-bold">
                Çıktı Konsolu:
              </span>
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                {sandboxLogs || "Kod konsolu boş."}
              </pre>
            </div>
          </div>
        </div>

        {/* Dynamic Chart Output panel */}
        <div className="space-y-3">
          <span className="text-zinc-500 text-[10px] font-bold tracking-widest block uppercase">
            Görselleştirme İstasyonu
          </span>

          <div className="bg-[#111115] border border-[#1f1f26] rounded-2xl p-4 h-[300px] flex flex-col justify-between overflow-hidden relative shadow-xl">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 border-b border-[#1f1f26] pb-2 font-bold uppercase tracking-wider">
              <span>VEKTÖREL SVG GRAFİĞİ</span>
              <span>ÇIKTI HATTI</span>
            </div>

            <div className="flex-1 flex items-center justify-center">
              {generatedChartSvg ? (
                <div
                  className="max-h-48 w-full flex items-center justify-center select-none"
                  dangerouslySetInnerHTML={{ __html: generatedChartSvg }}
                />
              ) : (
                <div className="flex flex-col items-center text-center text-zinc-500 space-y-2">
                  <BarChart2 className="w-7 h-7 text-zinc-600" />
                  <span className="text-xs font-bold text-zinc-400">Vektör Grafiği Boş</span>
                  <p className="text-[10px] max-w-xs text-zinc-500 leading-relaxed">
                    Sandbox içerisindeki kodunuz bir SVG yapısı çizdiğinde, yüksek kalitede burada render edilir.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
