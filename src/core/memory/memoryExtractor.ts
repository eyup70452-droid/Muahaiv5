import { logger } from "../utils/systemLogger";
import { memoryStore } from "./memoryStore";
import { systemEvents } from "../utils/systemEvents";

export async function extractMemories(messages: any[]) {
  if (messages.length < 2) return;
  
  const lastMessages = messages.slice(-4); // Son 4 mesajı analiz et
  const context = lastMessages.map(m => `${m.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${m.content}`).join("\n");

  logger.info("[Memory] Bilişsel çıkarım süreci başlatıldı...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Aşağıdaki konuşmayı analiz et ve kullanıcı hakkında hatırlanması gereken kritik bilgileri (isim, tercihler, projeler, kurallar) JSON formatında çıkar. 
        Sadece yeni ve önemli bilgileri al. Eğer yeni bilgi yoksa boş dizi döndür.
        JSON Yapısı: { "memories": [{ "content": "bilgi", "category": "fact/preference/rule/project" }] }
        
        Konuşma:
        ${context}`,
        mode: "fast",
        stream: false
      })
    });

    const data = await response.json();
    
    // JSON parse
    const jsonMatch = data.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.memories && Array.isArray(parsed.memories)) {
        parsed.memories.forEach((m: any) => {
          // Mevcut belleklerde varsa ekleme (basit kontrol)
          const exists = memoryStore.getMemories().some(em => 
            em.content.toLowerCase().includes(m.content.toLowerCase()) || 
            m.content.toLowerCase().includes(em.content.toLowerCase())
          );
          
          if (!exists) {
            memoryStore.addMemory(m.content, m.category);
            logger.info(`[Memory] Otomatik bellek eklendi: ${m.content}`);
            systemEvents.emit("memory", `Bilişsel Çıkarım: "${m.content.substring(0, 30)}..." belleğe işlendi.`);
          }
        });
      }
    }
  } catch (error) {
    logger.error("[Memory] Bellek çıkarımı sırasında hata:", error);
  }
}
