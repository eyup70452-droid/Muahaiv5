import React, { useState } from "react";
import { Sparkles, Volume2, Play, Image, Info, Database } from "lucide-react";
import { logger } from "../core/utils/systemLogger";

interface MediaHubProps {
  onGenerateImage: (prompt: string) => Promise<any>;
  onSynthesizeSpeech: (text: string) => Promise<any>;
}

export default function MediaHub({ onGenerateImage, onSynthesizeSpeech }: MediaHubProps) {
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);

  const [ttsText, setTtsText] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizedAudioUrl, setSynthesizedAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToMemory = async (type: "image" | "audio", content: string, title: string) => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: `[Medya Hub - ${type === "image" ? "SVG Görsel" : "Ses Sentezi"}]\nBaşlık: ${title}\nİçerik/Açıklama: ${content}` 
        })
      });
      if (res.ok) {
        showNotification(`${type === "image" ? "Görsel" : "Ses"} hafızaya kaydedildi!`, "success");
        logger.info(`[Media] ${type === "image" ? "Görsel" : "Ses"} hafızaya kaydedildi: ${title}`);
      }
    } catch (e) {
      logger.error("Medya hafızaya kaydedilirken hata oluştu", e);
      showNotification("Hafızaya kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" = "error") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleImgGenerate = async () => {
    if (!imagePrompt.trim() || isGeneratingImg) return;
    setIsGeneratingImg(true);
    logger.info(`[Media] Görsel üretimi başlatıldı: "${imagePrompt.substring(0, 30)}..."`);
    try {
      const res = await onGenerateImage(imagePrompt);
      if (res && res.success && res.url) {
        setGeneratedImgUrl(res.url);
        showNotification("Görsel başarıyla oluşturuldu ve yüklendi!", "success");
        logger.info("[Media] Görsel üretimi başarılı.");
      } else {
        showNotification("Görsel üretilemedi: " + (res?.error || "Bilinmeyen hata"), "error");
        logger.error("[Media] Görsel üretimi başarısız.", { error: res?.error });
      }
    } catch (err: any) {
      showNotification("Hata: " + err.message, "error");
      logger.error("[Media] Görsel üretimi sırasında istisna oluştu.", err);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleTtsGenerate = async () => {
    if (!ttsText.trim() || isSynthesizing) return;
    setIsSynthesizing(true);
    logger.info(`[Media] Ses sentezi başlatıldı: "${ttsText.substring(0, 30)}..."`);
    try {
      const res = await onSynthesizeSpeech(ttsText);
      if (res && res.success && res.url) {
        setSynthesizedAudioUrl(res.url);
        showNotification("Konuşma sentezleme başarıyla tamamlandı!", "success");
        logger.info("[Media] Ses sentezi başarılı.");
      } else {
        showNotification("Konuşma sentezlenemedi: " + (res?.error || "Bilinmeyen hata"), "error");
        logger.error("[Media] Ses sentezi başarısız.", { error: res?.error });
      }
    } catch (err: any) {
      showNotification("Hata: " + err.message, "error");
      logger.error("[Media] Ses sentezi sırasında istisna oluştu.", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#09090d] text-gray-200 font-sans relative">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl border transition-all duration-300 animate-fade-in ${
          notification.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-xs font-semibold">{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 text-xs opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-[#1f1f26] pb-5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-sm tracking-wide uppercase">
                MEDYA SENTEZ MERKEZİ
              </h2>
              <p className="text-zinc-400 text-xs mt-1">
                Yapay zekâ tabanlı vektör grafik çizici ve gelişmiş metinden sese seslendirici.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SVG Vector Generator */}
          <div className="bg-[#111115] border border-[#1f1f26] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <Image className="w-4 h-4" />
              <h3>Vektör SVG Çizici</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              İstediğiniz görseli tarif edin ve anında SVG vektör formatında oluşturulmasını sağlayın.
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-[#16161f] border border-[#1f1f26] rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-colors"
                  placeholder="Örn: parlayan ağ düğümü simgesi, cyberpunk..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />
                <button
                  onClick={handleImgGenerate}
                  disabled={isGeneratingImg || !imagePrompt.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-rose-500 to-fuchsia-600 hover:opacity-90 active:scale-95 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 rounded-xl text-white text-xs font-bold cursor-pointer transition-all"
                >
                  {isGeneratingImg ? "Çiziliyor..." : "Çiz"}
                </button>
              </div>
              <div className="h-48 bg-[#0c0c10] border border-[#1f1f26] rounded-xl flex items-center justify-center overflow-hidden">
                {isGeneratingImg ? (
                  <div className="text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <span className="text-xs text-rose-400 font-medium block animate-pulse">SVG Birleştiriliyor...</span>
                  </div>
                ) : generatedImgUrl ? (
                  <div className="relative group w-full h-full flex items-center justify-center">
                    <img src={generatedImgUrl} alt="Generated SVG" className="max-h-40 object-contain rounded-lg shadow-lg" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => handleSaveToMemory("image", imagePrompt, "SVG Tasarımı")}
                      disabled={isSaving}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-emerald-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg hover:scale-110 active:scale-95"
                      title="Hafızaya Kaydet"
                    >
                      <Database className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">Oluşturulan vektör görseli burada gösterilecek</span>
                )}
              </div>
            </div>
          </div>

          {/* Text-to-Speech (TTS) */}
          <div className="bg-[#111115] border border-[#1f1f26] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-fuchsia-400 font-bold text-xs uppercase tracking-wider">
              <Volume2 className="w-4 h-4" />
              <h3>Konuşma Sentezleyici (TTS)</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Herhangi bir metni yapay zekâ ses modeliyle gerçekçi bir konuşmaya dönüştürün.
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-[#16161f] border border-[#1f1f26] rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-colors"
                  placeholder="Seslendirilecek metni yazın..."
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />
                <button
                  onClick={handleTtsGenerate}
                  disabled={isSynthesizing || !ttsText.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-rose-500 to-fuchsia-600 hover:opacity-90 active:scale-95 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 rounded-xl text-white text-xs font-bold cursor-pointer transition-all"
                >
                  {isSynthesizing ? "Sentezleniyor..." : "Seslendir"}
                </button>
              </div>
              <div className="h-48 bg-[#0c0c10] border border-[#1f1f26] rounded-xl flex flex-col items-center justify-center p-4">
                {isSynthesizing ? (
                  <div className="text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <span className="text-xs text-fuchsia-400 font-medium block animate-pulse">Metin Sentezleniyor...</span>
                  </div>
                ) : synthesizedAudioUrl ? (
                  <div className="w-full space-y-4 text-center">
                    <div className="relative group inline-block">
                      <div className="w-10 h-10 bg-fuchsia-500/10 text-fuchsia-400 rounded-full flex items-center justify-center mx-auto">
                        <Play className="w-4 h-4 animate-pulse" />
                      </div>
                      <button 
                        onClick={() => handleSaveToMemory("audio", ttsText, "Ses Sentezi")}
                        disabled={isSaving}
                        className="absolute -top-1 -right-8 p-1.5 rounded-md bg-emerald-500 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md hover:scale-110 active:scale-95"
                        title="Hafızaya Kaydet"
                      >
                        <Database className="w-3 h-3" />
                      </button>
                    </div>
                    <audio src={synthesizedAudioUrl} controls className="w-full max-w-xs mx-auto text-xs" />
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">Seslendirilmiş ses dosyası burada gösterilecek</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c0c10]/40 border border-[#1f1f26] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Görsel ve ses sentezleyicileri doğrudan sohbet ekranındaki "+" butonu üzerinden de hızlıca tetikleyebilirsiniz. Sohbet ekranındaki komutlar bu motorları arka planda entegre çalıştırır.
          </p>
        </div>
      </div>
    </div>
  );
}
