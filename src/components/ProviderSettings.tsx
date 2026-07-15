import React, { useState } from "react";
import { Shield, Key, CheckCircle2, XCircle, ChevronDown, ChevronUp, Cpu, Server } from "lucide-react";
import { ProviderInfo, ModelInfo, ProviderId } from "../types";

interface ProviderSettingsProps {
  providers: ProviderInfo[];
  models: ModelInfo[];
  activeModelIds: string[];
  onToggleModel: (modelId: string) => void;
  onUpdateApiKey: (providerId: ProviderId, key: string) => void;
  onValidateKey: (providerId: ProviderId) => void;
  freeOnly: boolean;
  setFreeOnly: (val: boolean) => void;
}

export default function ProviderSettings({
  providers,
  models,
  activeModelIds,
  onToggleModel,
  onUpdateApiKey,
  onValidateKey,
  freeOnly,
  setFreeOnly
}: ProviderSettingsProps) {
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>("nvidia");
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});

  const handleKeyChange = (providerId: ProviderId, value: string) => {
    setEditingKeys((prev) => ({ ...prev, [providerId]: value }));
    onUpdateApiKey(providerId, value);
  };

  const getProviderModels = (providerId: ProviderId) => {
    return models.filter((m) => m.provider === providerId);
  };

  const categoryMap: Record<string, string> = {
    text: "SOHBET & MUHAKEME",
    code: "GELİŞMİŞ KODLAMA",
    vision: "GÖRSEL ANALİZ (MULTIMODAL)",
    audio: "SES SENTEZLEME",
    embedding: "VEKTÖR GÖMME",
    image_gen: "GÖRSEL ÜRETİMİ",
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0b0e] text-gray-200 p-6 md:p-8 lg:p-10 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-8 fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#1f1f26] pb-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Server className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight font-display uppercase">Model Sağlayıcıları</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  Küresel yapay zekâ ağ geçitlerini ve API bağlantılarını yapılandırın.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#111116] border border-[#1f1f26] px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-200 uppercase tracking-wider font-display">Bütçe Dostu Mod</span>
              <span className="text-[10px] text-gray-500">Yalnızca ücretsiz katmanlı modelleri listele</span>
            </div>
            <button
              onClick={() => setFreeOnly(!freeOnly)}
              className={`px-3 py-1.5 text-[10px] font-bold font-mono border transition-all ${
                freeOnly
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-transparent border-[#1f1f26] text-gray-500 hover:text-gray-300"
              }`}
            >
              {freeOnly ? "AKTİF" : "DEVRE DIŞI"}
            </button>
          </div>
        </div>

        {/* Provider List */}
        <div className="space-y-3">
          {providers.map((p) => {
            const isExpanded = expandedProvider === p.id;
            const providerModels = getProviderModels(p.id);
            const currentEditingKey = editingKeys[p.id] !== undefined ? editingKeys[p.id] : (p.hasKey ? "••••••••••••••••••••" : "");

            const groupedModels = providerModels.reduce((acc, m) => {
              const cat = m.category[0] || "text";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(m);
              return acc;
            }, {} as Record<string, typeof providerModels>);

            return (
              <div
                key={p.id}
                className={`border transition-all duration-200 ${
                  isExpanded
                    ? "bg-[#141419] border-[#2e2e38] shadow-md shadow-black/45"
                    : "bg-[#0f0f13] border-[#16161b] hover:border-[#1f1f26]"
                }`}
              >
                {/* Provider Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer group select-none"
                  onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="text-xs font-mono font-bold w-10 h-10 flex items-center justify-center bg-[#141419] border border-[#1f1f26] group-hover:border-[#2a2a35] text-gray-400 group-hover:text-white transition-colors">
                      {p.logo}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 font-display uppercase tracking-wider">{p.name}</h3>
                      <span className="text-[10px] font-mono text-gray-400 block mt-0.5">
                        {providerModels.length} MODEL YAPILANDIRILDI
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {p.hasKey ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase">Doğrulandı</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-500/5 border border-gray-500/10">
                        <XCircle className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[10px] font-bold font-mono text-gray-400 uppercase">Eksik</span>
                      </div>
                    )}
                    <button className="text-gray-500 hover:text-white transition-colors p-1 bg-transparent border-0 cursor-pointer">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Provider Details (Expanded) */}
                {isExpanded && (
                  <div className="p-5 border-t border-[#1f1f26] bg-[#0c0c10] flex flex-col md:flex-row gap-8">
                    
                    {/* Left Col: API Key */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-display flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-rose-400" /> API Yetkilendirme
                        </h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Doğrudan anahtar bağlantısı. Kimlik bilgileriniz yalnızca yerel oturum belleğinizde şifreli saklanır.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 max-w-sm">
                        <input
                          type="password"
                          className="w-full bg-[#0e0e12] border border-[#1f1f26] px-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-rose-500/50 font-mono transition-colors"
                          placeholder={p.apiKeyPlaceholder}
                          value={currentEditingKey}
                          onChange={(e) => handleKeyChange(p.id, e.target.value)}
                        />
                        <button
                          onClick={() => onValidateKey(p.id)}
                          className="w-full py-2 bg-[#14141a] hover:bg-rose-500 hover:text-white border border-[#1f1f26] hover:border-rose-500 text-gray-300 text-[11px] font-bold uppercase tracking-wider font-display transition-all"
                        >
                          Bağlantıyı Doğrula ve Güncelle
                        </button>
                      </div>
                    </div>

                    {/* Right Col: Models List */}
                    <div className="flex-[1.5] space-y-4 md:border-l md:border-[#1f1f26] md:pl-8">
                      <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-display flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-purple-400" /> Modül Seçimi
                      </h4>
                      <div className="space-y-5">
                        {Object.entries(groupedModels).map(([catId, catModels]) => (
                          <div key={catId} className="space-y-2">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                              {categoryMap[catId] || catId}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {catModels.map((m) => {
                                const isActive = activeModelIds.includes(m.id);
                                return (
                                  <div
                                    key={`${m.id}-${m.provider || 'prov'}`}
                                    onClick={() => onToggleModel(m.id)}
                                    className={`p-2.5 flex items-center justify-between border cursor-pointer transition-all duration-150 ${
                                      isActive
                                        ? "bg-rose-500/5 border-rose-500/30 text-rose-300"
                                        : "bg-[#0e0e12] border-[#16161b] hover:border-[#1f1f26]"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`w-1.5 h-1.5 shrink-0 ${isActive ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : "bg-gray-700"}`} />
                                      <span className={`text-xs truncate block font-mono font-medium ${isActive ? "text-rose-200" : "text-gray-400"}`}>
                                        {m.displayName}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Security Notice */}
        <div className="p-4 border border-rose-500/10 bg-rose-500/5 flex items-start gap-3">
          <Shield className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider font-display">Askeri Sınıf Yerel Güvenlik</h4>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              API bağlantı koordinatlarınız tamamen istemci taraflı (Local Storage) üzerinde maskelenerek saklanır. Sunucularımızda hiçbir API anahtarı veya asistan kimliği loglanmaz, üçüncü şahıslarla paylaşılmaz.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

