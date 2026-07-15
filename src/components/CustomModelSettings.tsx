import React, { useState, useEffect } from "react";
import { Settings, Save, X, Plus, Trash2, CheckCircle, ExternalLink, Shield } from "lucide-react";
import { CustomProvider } from "../types";
import { logger } from "../core/utils/systemLogger";

interface CustomModelSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  providers: CustomProvider[];
  onSave: (providers: CustomProvider[]) => void;
}

export default function CustomModelSettings({ isOpen, onClose, providers, onSave }: CustomModelSettingsProps) {
  const [localProviders, setLocalProviders] = useState<CustomProvider[]>(providers);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);

  const [form, setForm] = useState<CustomProvider>({
    id: "",
    name: "",
    baseUrl: "",
    apiKey: "",
    modelId: "",
    isActive: false,
    fetchedModels: []
  });

  // Sync state with parent's providers list when modal is opened or changed
  useEffect(() => {
    if (isOpen) {
      setLocalProviders(providers);
    }
  }, [isOpen, providers]);

  if (!isOpen) return null;

  const handleAdd = () => {
    setEditingIndex(-1);
    setTestResult(null);
    setForm({
      id: `custom-${Date.now()}`,
      name: "",
      baseUrl: "https://transfer-api.eypng140.workers.dev/v1/chat/completions",
      apiKey: "",
      modelId: "",
      isActive: true,
      fetchedModels: []
    });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setTestResult(null);
    setForm(localProviders[index]);
  };

  const handleTest = async () => {
    if (!form.baseUrl) return;
    setIsTesting(true);
    setTestResult(null);
    logger.addLog('info', `Özel model testi başlatılıyor: ${form.baseUrl}`, { form }, 'CustomSettings');
    
    try {
      const isLocalhost = form.baseUrl.includes('localhost') || form.baseUrl.includes('127.0.0.1');
      const modelsUrl = form.baseUrl.replace(/\/chat\/completions\/?$/, "/models");
      
      let data;
      if (isLocalhost) {
        logger.addLog('info', `Localhost tespiti: Direkt tarayıcı testi yapılıyor.`, { modelsUrl }, 'CustomSettings');
        const res = await fetch(modelsUrl, {
          headers: { 
            "Authorization": `Bearer ${form.apiKey || ""}`,
            "Content-Type": "application/json"
          }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const rawData = await res.json();
        // Normalize models list
        const models = (rawData.data || rawData.models || rawData).map((m: any) => m.id || m.name || m).filter((m: any) => typeof m === 'string');
        data = { success: true, models };
      } else {
        logger.addLog('info', `Bulut testi: Proxy kullanılıyor.`, { modelsUrl }, 'CustomSettings');
        const res = await fetch("/api/proxy-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: modelsUrl, apiKey: form.apiKey })
        });
        data = await res.json();
      }
      
      if (data.success && data.models?.length > 0) {
        logger.addLog('info', `Test başarılı, ${data.models.length} model bulundu.`, data.models, 'CustomSettings');
        setTestResult({ success: true, message: `${data.models.length} model bulundu`, models: data.models });
        setForm(prev => ({ ...prev, fetchedModels: data.models }));
      } else if (data.success) {
        logger.addLog('warn', 'Bağlantı başarılı ancak model listesi boş döndü.', data, 'CustomSettings');
        setTestResult({ success: true, message: "Bağlantı başarılı (Ancak model listesi boş. Model ID'yi manuel girin.)" });
      } else {
        logger.addLog('error', `Bağlantı hatası: ${data.error}`, data, 'CustomSettings');
        setTestResult({ success: false, message: `Hata: ${data.error}` });
      }
    } catch (e: any) {
      const isLocalhost = form.baseUrl.includes('localhost') || form.baseUrl.includes('127.0.0.1');
      logger.addLog('error', `Bağlantı hatası: ${e.message}`, e, 'CustomSettings');
      
      let msg = `Bağlantı hatası: ${e.message}.`;
      if (isLocalhost) {
        msg = `TARAYICI ENGELİ: HTTPS üzerinden HTTP (localhost) bağlantısı yapılamaz. 

ÇÖZÜM:
1. Adres çubuğundaki kilit 🔒 simgesine tıklayın.
2. 'Site Ayarları'na gidin.
3. 'Güvensiz İçerik' (Insecure Content) seçeneğini 'İzin Ver' (Allow) yapın.
4. Sayfayı yenileyip tekrar deneyin.`;
      }
      
      setTestResult({ success: false, message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveForm = () => {
    if (!form.name || !form.baseUrl) {
      alert("Lütfen en azından Sağlayıcı Adı ve Endpoint alanlarını doldurun.");
      return;
    }

    let newList = [...localProviders];
    const newProvider = { ...form };
    
    // If it's a new provider or being edited to be active
    if (newProvider.isActive) {
      // Deactivate all others
      newList = newList.map(p => ({ ...p, isActive: false }));
    }

    if (editingIndex === -1) {
      newList.push(newProvider);
    } else if (editingIndex !== null) {
      newList[editingIndex] = newProvider;
    }

    setLocalProviders(newList);
    onSave(newList);
    setEditingIndex(null);
    onClose();
    logger.addLog('system', `Özel model yapılandırması kaydedildi: ${form.name}`, { provider: form }, 'CustomSettings');
  };

  const handleDelete = (index: number) => {
    const newList = localProviders.filter((_, i) => i !== index);
    setLocalProviders(newList);
    onSave(newList);
  };

  const toggleActive = (index: number) => {
    const newList = localProviders.map((p, i) => ({
      ...p,
      isActive: i === index ? !p.isActive : false
    }));
    setLocalProviders(newList);
    onSave(newList);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-[#111114] border border-[#23232c] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#23232c] bg-[#16161c]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-sans">Özel Sağlayıcılar</h2>
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-mono tracking-tighter">API GATEWAY & LOCALHOST CONFIGURATION</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {editingIndex === null ? (
            <div className="space-y-4">
              {localProviders.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[#23232c] rounded-xl">
                  <div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
                    <Plus className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-white font-medium">Henüz Özel Sağlayıcı Yok</h3>
                  <p className="text-sm text-gray-400 mt-1">Sınırsız havuz veya kendi sunucularınızı ekleyin.</p>
                  <button 
                    onClick={handleAdd}
                    className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Sağlayıcı Ekle
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">Kayıtlı Sağlayıcılar</h3>
                    <button 
                      onClick={handleAdd}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ekle
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {localProviders.map((provider, idx) => (
                      <div 
                        key={provider.id}
                        className={`p-3 sm:p-4 rounded-xl border transition-all ${
                          provider.isActive 
                            ? "bg-indigo-500/5 border-indigo-500/30" 
                            : "bg-[#16161c] border-[#23232c] hover:border-gray-700"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${provider.isActive ? "bg-indigo-500/20 text-indigo-400" : "bg-gray-800 text-gray-500"}`}>
                              {provider.isActive ? <CheckCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <h4 className="font-bold text-white text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{provider.name}</h4>
                                {provider.isActive && (
                                  <span className="text-[8px] sm:text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Aktif</span>
                                )}
                              </div>
                              <p className="text-[11px] sm:text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[200px] sm:max-w-[250px]">{provider.modelId || "Model belirtilmemiş"}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 w-full sm:w-auto border-t sm:border-0 border-white/5 pt-2.5 sm:pt-0">
                            <button 
                              onClick={() => toggleActive(idx)}
                              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition ${
                                provider.isActive 
                                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" 
                                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-transparent"
                              }`}
                            >
                              {provider.isActive ? "Pasif Yap" : "Aktifleştir"}
                            </button>
                            <button onClick={() => handleEdit(idx)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition" title="Düzenle">
                              <Settings className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(idx)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition" title="Sil">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold">{editingIndex === -1 ? "Yeni Sağlayıcı Ekle" : "Sağlayıcıyı Düzenle"}</h3>
                <button onClick={() => setEditingIndex(null)} className="text-xs text-gray-500 hover:text-gray-300">Vazgeç</button>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Sağlayıcı Adı</label>
                  <input 
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    placeholder="Örn: Sınırsız Havuz (Gateway)"
                    className="w-full bg-[#1c1c24] border border-[#2d2d38] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Endpoint URL (Completions)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={form.baseUrl}
                      onChange={(e) => setForm({...form, baseUrl: e.target.value})}
                      placeholder="https://.../v1/chat/completions"
                      className="w-full bg-[#1c1c24] border border-[#2d2d38] rounded-lg px-4 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono"
                    />
                    <ExternalLink className="w-4 h-4 text-gray-600 absolute left-3.5 top-3" />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" /> OpenAI Chat Completions uyumlu endpoint olmalıdır.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">API Key</label>
                    <input 
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => setForm({...form, apiKey: e.target.value})}
                      placeholder="sk-..."
                      className="w-full bg-[#1c1c24] border border-[#2d2d38] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Model ID</label>
                    <input 
                      type="text"
                      value={form.modelId}
                      onChange={(e) => setForm({...form, modelId: e.target.value})}
                      placeholder="gpt-4o, gateway-claude-..."
                      className="w-full bg-[#1c1c24] border border-[#2d2d38] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 mt-2">
                  <input 
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({...form, isActive: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-300 font-medium cursor-pointer">
                    Bu sağlayıcıyı varsayılan olarak kullan
                  </label>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={isTesting || !form.baseUrl}
                    className="w-full py-2.5 bg-[#1c1c24] hover:bg-[#252530] border border-[#2d2d38] text-gray-300 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
                  >
                    {isTesting ? (
                      <><div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" /> Kontrol ediliyor...</>
                    ) : (
                      <><ExternalLink className="w-4 h-4" /> Bağlantıyı Test Et & Modelleri Çek</>
                    )}
                  </button>

                  {testResult && (
                    <div className={`p-3 rounded-lg border text-sm animate-in fade-in zoom-in-95 duration-200 ${testResult.success ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
                      <div className="flex items-start gap-2 font-medium">
                        {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                        <div className="flex-1 whitespace-pre-wrap leading-relaxed text-[11px] sm:text-sm">
                          {testResult.message}
                          {!testResult.success && form.baseUrl.includes('localhost') && (
                             <div className="mt-2 p-2 bg-white/5 rounded text-[10px] text-gray-400 border border-white/5">
                               💡 İpucu: Tarayıcı ayarlarından "Güvensiz içerik" izni verirseniz test başarısız olsa bile bağlantı kurulabilir.
                             </div>
                          )}
                        </div>
                      </div>
                      {testResult.models && testResult.models.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Mevcut Modeller — Tıklayarak Seç:</p>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto no-scrollbar">
                    {testResult.models.map((m, idx) => (
                      <button
                        key={`${m}-${idx}`}
                        type="button"
                        onClick={() => setForm({ ...form, modelId: m })}
                        className={`text-[10px] px-2 py-1 rounded border font-mono transition-all duration-200 ${form.modelId === m ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 scale-105" : "bg-white/5 border-white/10 text-gray-400 hover:border-indigo-500/30 hover:text-gray-200"}`}
                      >
                        {m}
                      </button>
                    ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={handleSaveForm}
                className="w-full py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-xl shadow-white/5"
              >
                <Save className="w-4 h-4" />
                Kaydet ve Uygula
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#16161c] border-t border-[#23232c] flex justify-between items-center px-6">
          <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            Sistem Hazır
          </div>
          <p className="text-[10px] text-gray-600 italic">Veriler tarayıcınızda (localStorage) şifreli saklanır.</p>
        </div>
      </div>
    </div>
  );
}
