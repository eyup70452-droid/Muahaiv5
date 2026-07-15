import { GoogleGenAI } from "@google/genai";

/**
 * AI Orchestrator OS - Hyper-Cognition & Self-Healing Engine
 * Highly optimized middleware to run any model (even weaker ones) with top-tier reasoning,
 * absolute syntax safety, and automatic real-time error correction.
 */
export class HyperCognitionEngine {
  /**
   * Enhances system instructions to inject strict coding guidelines, complete implementations,
   * syntax verification, and self-correction instructions.
   */
  static enhanceSystemInstruction(originalInstruction: string, behaviorMode: string, effortLevel: string): string {
    const hyperGuidelines = `
[COGNITIVE ARCHITECTURE: HYPER-CORRECTNESS EMPOWERED]
- **TÜM KODLARI TAM VE EKSİKSİZ YAZIN**: Asla '// burası aynı kalacak', '// TODO', '// implement here' veya placeholder yorumları kullanmayın. Her zaman çalıştırılabilir, dosyaya yazılabilir tam kod bloğunu üretin.
- **TİP GÜVENLİĞİ VE İTHALAT (IMPORTS)**: Kullandığınız tüm fonksiyonların, kütüphanelerin ve bileşenlerin import ifadelerini dosyanın en üstüne ekleyin. TypeScript tiplerini eksiksiz tanımlayın (any kullanımından kaçının).
- **SÖZDİZİMİ VE PARANTEZ KONTROLÜ (SYNTAX DIRECTIVE)**: Yazdığınız kodlardaki tüm açılan parantezlerin, süslü parantezlerin ve tırnak işaretlerinin doğru şekilde kapatıldığından emin olun.
- **KENDİ KENDİNİ DENETLEME (SELF-HEALING PRE-CHECK)**: Yanıtınızı göndermeden önce zihninizde bir kez çalıştırıp derleme hatalarını simüle edin. Eğer bir hata bulursanız, göndermeden önce doğrudan düzeltin.
- **MARKDOWN DENGESİ**: Kod bloklarını açtıysanız (\`\`\`) mutlaka kapatın.
`;
    return `${originalInstruction || ""}\n${hyperGuidelines}`;
  }

  /**
   * Detects and auto-closes unclosed code blocks and HTML elements in a streamed response.
   * This prevents markdown corruption or UI breaking if a model gets cut off.
   */
  static autoRepairStreamBuffer(text: string): string {
    let repaired = text;

    // Auto-repair code blocks
    const codeBlockOccurrences = (repaired.match(/```/g) || []).length;
    if (codeBlockOccurrences % 2 !== 0) {
      // Unclosed code block detected
      repaired += "\n```";
    }

    // Auto-repair HTML/JSX tags if possible
    // Simple tag balancer for common tags
    const commonTags = ["div", "span", "button", "form", "p", "a"];
    for (const tag of commonTags) {
      const openCount = (repaired.match(new RegExp(`<${tag}[^>]*>`, "g")) || []).length;
      const closeCount = (repaired.match(new RegExp(`</${tag}>`, "g")) || []).length;
      if (openCount > closeCount) {
        repaired += `</${tag}>`.repeat(openCount - closeCount);
      }
    }

    return repaired;
  }

  /**
   * Parses code blocks from a text response and validates their syntax.
   * If a syntax error is detected, and we have a Google API Key, we use gemini-2.5-flash
   * as a "Cognitive Corrector" to instantly fix the code.
   */
  static async healModelOutput(
    text: string, 
    userQuery: string, 
    googleApiKey?: string
  ): Promise<string> {
    const codeBlockRegex = /```(typescript|javascript|tsx|jsx|json|html|css)?\n([\s\S]*?)```/g;
    let match;
    let modifiedText = text;
    const codeBlocks: { full: string, lang: string, code: string }[] = [];

    while ((match = codeBlockRegex.exec(text)) !== null) {
      codeBlocks.push({
        full: match[0],
        lang: match[1] || "typescript",
        code: match[2]
      });
    }

    // If there are no code blocks, return original text
    if (codeBlocks.length === 0) {
      return text;
    }

    // Check code blocks for obvious syntactical errors (e.g. unclosed braces, brackets, or template literals)
    let needsHeal = false;
    let healReason = "";

    for (const block of codeBlocks) {
      const code = block.code;
      
      // Simple bracket balancer
      const brackets = { '{': '}', '[': ']', '(': ')' };
      const stack: string[] = [];
      let isUnbalanced = false;

      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (char in brackets) {
          stack.push(char);
        } else if (Object.values(brackets).includes(char)) {
          const last = stack.pop();
          if (!last || brackets[last as keyof typeof brackets] !== char) {
            isUnbalanced = true;
            break;
          }
        }
      }

      if (isUnbalanced || stack.length > 0) {
        needsHeal = true;
        healReason += `Bracket imbalance detected (stack: ${stack.join(",")}). `;
      }

      // Check for placeholder indicators
      if (code.includes("// TODO") || code.includes("/* TODO") || code.includes("// implement here") || code.includes("// buraya gelecek")) {
        needsHeal = true;
        healReason += "Placeholder code detected. ";
      }
    }

    // If healing is needed and we have an API key, we run a fast correction request using gemini-2.5-flash
    if (needsHeal && googleApiKey) {
      console.log(`[HyperCognition] Auto-Correction triggered. Reason: ${healReason}`);
      try {
        const ai = new GoogleGenAI({
          apiKey: googleApiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const healPrompt = `
Kullanıcının asıl isteği: "${userQuery}"

Aşağıdaki yapay zekâ yanıtı hatalı, tamamlanmamış veya sözdizimi (parantez eşleşmesi, eksik import vb.) hataları içeriyor. Ayrıca '// TODO' veya eksik kalan kodlar bulunuyor.
Lütfen bu kodları analiz et ve eksiksiz, mükemmel çalışan, tüm parantezleri kapalı ve çalıştırılabilir bir şekilde düzelt.
Metindeki açıklayıcı kısımları aynen koru veya iyileştir, sadece kod bloklarını onar. Eksik hiçbir fonksiyon bırakma.

DÜZELTİLECEK METİN:
---
${text}
---

Lütfen sadece onarılmış metni çıktı olarak ver. "Düzeltilmiş hali şudur" gibi açıklama ekleme, doğrudan nihai onarılmış yanıtı yaz.
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: healPrompt
        });

        if (response.text) {
          console.log(`[HyperCognition] Successful correction. Replaced original response.`);
          return response.text;
        }
      } catch (e: any) {
        console.error("[HyperCognition] Automated correction failed, falling back to static repair:", e.message);
      }
    }

    // Fallback to static bracket repair if no API key or API fails
    let staticallyRepairedText = text;
    for (const block of codeBlocks) {
      let code = block.code;
      
      // Close open backticks
      const backticksCount = (code.match(/`/g) || []).length;
      if (backticksCount % 2 !== 0) {
        code += "`";
      }

      // Balance trailing curly braces and brackets
      const openCurly = (code.match(/\{/g) || []).length;
      const closeCurly = (code.match(/\}/g) || []).length;
      if (openCurly > closeCurly) {
        code += "\n" + "}".repeat(openCurly - closeCurly);
      }

      const openSquare = (code.match(/\[/g) || []).length;
      const closeSquare = (code.match(/\]/g) || []).length;
      if (openSquare > closeSquare) {
        code += "\n" + "]".repeat(openSquare - closeSquare);
      }

      const openParen = (code.match(/\(/g) || []).length;
      const closeParen = (code.match(/\)/g) || []).length;
      if (openParen > closeParen) {
        code += "\n" + ")".repeat(openParen - closeParen);
      }

      const repairedBlock = `\`\`\`${block.lang}\n${code}\n\`\`\``;
      staticallyRepairedText = staticallyRepairedText.replace(block.full, repairedBlock);
    }

    return staticallyRepairedText;
  }
}
