import { runTool, ToolExecutionResult } from "../tools/runTool";

export interface SlashCommandResult {
  isSlashCommand: boolean;
  commandName: string;
  args: string;
  executed: boolean;
  message?: string;
  reasoning?: string;
  toolResult?: ToolExecutionResult;
}

export async function parseAndExecuteSlashCommand(
  inputText: string,
  context: {
    clearChat?: () => void;
    addSystemMessage?: (content: string, toolCalls?: any[]) => void;
    files?: any[];
  }
): Promise<SlashCommandResult> {
  const trimmed = inputText.trim();
  if (!trimmed.startsWith("/")) {
    return { isSlashCommand: false, commandName: "", args: "", executed: false };
  }

  const parts = trimmed.slice(1).split(" ");
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (commandName) {
    case "clear":
      if (context.clearChat) {
        context.clearChat();
        return { isSlashCommand: true, commandName, args, executed: true, message: "Sohbet başarıyla temizlendi." };
      }
      return { isSlashCommand: true, commandName, args, executed: false, message: "Sohbet temizleme fonksiyonu bulunamadı." };

    case "search":
      if (args) {
        const result = await runTool("web_search_tool", { query: args });
        return {
          isSlashCommand: true,
          commandName,
          args,
          executed: true,
          toolResult: result,
          message: result.success
            ? `🔍 **Web Araması Tamamlandı:** "${args}"\n\nKaynak: ${result.output.source}\n\nSonuçlar:\n${result.output.results
                .map((r: any) => `- **${r.title}**\n  ${r.snippet} [Git](${r.url})`)
                .join("\n")}`
            : `[ERR] Web araması başarısız oldu: ${result.error}`
        };
      }
      return { isSlashCommand: true, commandName, args, executed: true, message: "[WARN] Lütfen arama sorgusu girin. Örn: `/search react 19`" };

    case "deep":
      if (args) {
        const result = await runTool("deep_think_tool", { prompt: args, steps: 3 });
        return {
          isSlashCommand: true,
          commandName,
          args,
          executed: true,
          toolResult: result,
          reasoning: result.success ? result.output.thinkingProcess.join("\n") : undefined,
          message: result.success
            ? result.output.finalDecision
            : `[ERR] Muhakeme hatası: ${result.error}`
        };
      }
      return { isSlashCommand: true, commandName, args, executed: true, message: "[WARN] Lütfen bir soru/prompt girin. Örn: `/deep kuantum bilgisayarlar`" };

    case "code":
      if (args) {
        const result = await runTool("code_execution_tool", { code: args, language: "typescript" });
        return {
          isSlashCommand: true,
          commandName,
          args,
          executed: true,
          toolResult: result,
          message: result.success
            ? `💻 **Sandbox Çalıştırıldı**\n\nÇıktı:\n\`\`\`\n${result.output.output}\n\`\`\``
            : `[ERR] Derleme hatası: ${result.error}`
        };
      }
      return { isSlashCommand: true, commandName, args, executed: true, message: "[WARN] Lütfen çalıştırılacak TypeScript/JS kodunu girin. Örn: `/code console.log(12 * 12)`" };

    case "analyze":
      if (context.files && context.files.length > 0) {
        const result = await runTool("file_analysis_tool", { files: context.files, query: args });
        return {
          isSlashCommand: true,
          commandName,
          args,
          executed: true,
          toolResult: result,
          message: result.success
            ? `📂 **Dosya Analizi Başarılı**\n\n${result.output.queryRelevance}\n\nDosya Özetleri:\n${result.output.summaries
                .map((s: any) => `- **${s.name}** (${s.sizeBytes} bytes, ${s.lineCount} satır)`)
                .join("\n")}`
            : `[ERR] Dosya analizi başarısız oldu: ${result.error}`
        };
      }
      return { isSlashCommand: true, commandName, args, executed: true, message: "[WARN] Analiz edilecek aktif dosya bulunamadı. Önce bir dosya yüklemelisiniz." };

    case "help":
      const helpText = `🛠️ **Desteklenen Eğik Çizgi (Slash) Komutları:**\n\n` +
        `- \`/search <sorgu>\`: Belirtilen sorguyu web arama motoru ile tarar.\n` +
        `- \`/deep <soru>\`: Soruyu çok aşamalı muhakeme motorunda çözer.\n` +
        `- \`/code <code>\`: TypeScript/JS kodunu güvenli sandbox üzerinde derler.\n` +
        `- \`/analyze <sorgu>\`: Yüklenmiş olan tüm dosyaları tarar ve analiz eder.\n` +
        `- \`/clear\`: Sohbet ekranındaki tüm mesaj geçmişini temizler.\n` +
        `- \`/help\`: Bu yardım kılavuzunu görüntüler.`;
      return { isSlashCommand: true, commandName, args, executed: true, message: helpText };

    default:
      return { isSlashCommand: true, commandName, args, executed: false, message: `[WARN] Bilinmeyen komut: \`/${commandName}\`. Desteklenen komutların listesi için \`/help\` yazabilirsiniz.` };
  }
}
