import { planAgentTask, routeToolForStep } from "./planner";
import { runTool } from "../tools/runTool";
import { logger } from "../utils/systemLogger";

export interface AgentStep {
  id: string;
  description: string;
  toolId?: string;
  input?: any;
  output?: any;
  status: "pending" | "running" | "completed" | "failed";
}

export interface AgentTaskState {
  id: string;
  goal: string;
  steps: AgentStep[];
  status: "idle" | "planning" | "running" | "completed" | "failed";
  result?: {
    goal: string;
    plan: string[];
    execution: any[];
    finalAnswer: string;
  };
}

/**
 * Executes a fully autonomous multi-step agent loop directly on the client side.
 * Planning and Tool Routing are handled by AI, while progress is updated in real-time.
 */
export async function runAgentTask(
  goal: string,
  options: {
    files?: any[];
    onProgress?: (task: AgentTaskState) => void;
    modelId?: string;
    providerId?: string;
    customApiKey?: string;
  } = {}
): Promise<any> {
  const { onProgress, customApiKey } = options;
  const apiKey = customApiKey;

  logger.info(`[Autonomous Agent] Başlatıldı: "${goal}"`);

  // Phase 1: Initialize & Planning State
  const taskState: AgentTaskState = {
    id: `task-${Date.now()}`,
    goal,
    steps: [
      { id: "planning-step", description: "Yapay zekâ hedefinizi analiz ediyor ve adımları planlıyor...", status: "running" }
    ],
    status: "planning"
  };

  if (onProgress) onProgress({ ...taskState });

  try {
    // Generate sequential steps
    const steps = await planAgentTask(goal);
    
    // Map planned steps
    taskState.steps = steps.map((step, idx) => ({
      id: `step-${idx}`,
      description: step,
      status: "pending"
    }));
    taskState.status = "running";
    if (onProgress) onProgress({ ...taskState });

    const memory: any[] = [];

    // Phase 2: Sequential Execution Loop
    for (let i = 0; i < steps.length; i++) {
      taskState.steps[i].status = "running";
      if (onProgress) onProgress({ ...taskState });

      const step = steps[i];
      
      // Decided tool with AI Routing
      const toolId = await routeToolForStep(step, goal);
      taskState.steps[i].toolId = toolId;

      // Construct context from previous steps for Tool Chaining
      const contextSummary = memory.map((m, idx) => `[Step ${idx + 1} Output]: ${JSON.stringify(m.output).slice(0, 500)}`).join("\n");
      
      let input: any = {};
      try {
        if (toolId === "web_search_tool") {
          const optimizePrompt = `
            We are executing step: "${step}".
            The overall objective is: "${goal}".
            Our previous progress outputs:
            ${contextSummary || "None"}

            Formulate a precise search query (max 6-8 words) for Google to get relevant missing data.
            Response inside 'response' key MUST be just the search query string and nothing else.
          `;
          const res = await runTool("ai_think_tool", { prompt: optimizePrompt, __apiKey: apiKey }, { apiKey });
          const optimizedQuery = res.success && res.result?.response ? String(res.result.response).trim() : step;
          input = { query: optimizedQuery };
        } else if (toolId === "code_execution_tool") {
          const codePrompt = `
            We are executing step: "${step}".
            Previous context and findings:
            ${contextSummary || "None"}

            Generate a small, runnable Javascript snippet that processes/calculates or validates this step.
            Ensure to use console.log to print any final result.
            Return ONLY the javascript code, NO markdown blocks, NO explanations. Just raw JS code inside the 'response' key.
          `;
          const res = await runTool("ai_think_tool", { prompt: codePrompt, __apiKey: apiKey }, { apiKey });
          let code = res.success && res.result?.response ? String(res.result.response).trim() : `console.log("Processing step: ${step}");`;
          if (code.includes("```")) {
            code = code.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "").trim();
          }
          input = { code };
        } else if (toolId === "file_analysis_tool") {
          input = { fileContent: `Step Action: ${step}\nCumulative Context:\n${contextSummary || "No previous files uploaded."}` };
        } else {
          input = {
            prompt: `
              Execute the following step: "${step}"
              Overall Goal: "${goal}"

              Cumulative memory and progress from previous steps:
              ${contextSummary || "None"}

              Provide detailed strategic reasoning and execute this task step.
            `
          };
        }
      } catch (err) {
        logger.error("[Autonomous Agent] Girdi zincirleme hatası:", err);
        input = { prompt: step };
      }

      taskState.steps[i].input = input;
      if (onProgress) onProgress({ ...taskState });

      // Run tool with error handling & single retry
      let success = false;
      let output: any = null;
      let errorMsg: string | undefined;

      try {
        let res = await runTool(toolId, input, { apiKey });
        if (res.success) {
          success = true;
          output = res.result;
        } else {
          errorMsg = res.error || "Tool returned success=false";
          logger.warn(`[Autonomous Agent] Başarısız araç ${toolId}, tek seferlik yeniden deneme başlatılıyor...`);
          
          res = await runTool(toolId, input, { apiKey });
          if (res.success) {
            success = true;
            output = res.result;
          } else {
            errorMsg = res.error || "Tool returned success=false on retry";
          }
        }
      } catch (err: any) {
        errorMsg = err.message || "Execution exception";
        logger.warn(`[Autonomous Agent] İstisnai durum oluştu: ${errorMsg}. Yeniden deneniyor...`);
        try {
          const res = await runTool(toolId, input, { apiKey });
          if (res.success) {
            success = true;
            output = res.result;
          }
        } catch (retryErr: any) {
          errorMsg = retryErr.message || "Execution exception on retry";
        }
      }

      // Fallback to general reasoning if tool failed
      if (!success) {
        logger.warn(`[Autonomous Agent] Araç yürütülemedi. Bilişsel düşünme devreye sokuluyor.`);
        const fallbackPrompt = `
          The tool "${toolId}" failed to execute the step "${step}".
          Error: ${errorMsg || "Unknown error"}.
          Goal: "${goal}".
          
          We have the following previous results in memory:
          ${contextSummary || "None"}

          Formulate a plausible logical analysis/output for this step despite the tool failure, so that we can proceed safely.
        `;
        try {
          const res = await runTool("ai_think_tool", { prompt: fallbackPrompt, __apiKey: apiKey }, { apiKey });
          if (res.success && res.result) {
            success = true;
            output = {
              fallback: true,
              reasoning: res.result.thinking || "Fallback completed.",
              response: res.result.response || "Continued with assumptions."
            };
          } else {
            output = { fallback: true, error: errorMsg };
          }
        } catch (e: any) {
          output = { fallback: true, error: errorMsg, criticalError: e.message };
        }
      }

      taskState.steps[i].output = output;
      taskState.steps[i].status = success ? "completed" : "failed";
      if (onProgress) onProgress({ ...taskState });

      memory.push({
        step: i,
        input,
        output
      });
    }

    // Phase 3: Synthesize Findings
    logger.info("[Autonomous Agent] Tüm adımlar tamamlandı. Rapor oluşturuluyor...");
    const synthesisPrompt = `
      You are the Master AI Coordinator of AI Orchestrator OS.
      The overall goal is: "${goal}".

      Here is the structured plan and memory of executions:
      ${memory.map((m, idx) => `
      STEP ${idx + 1}: ${steps[idx]}
      Input used: ${JSON.stringify(m.input).slice(0, 500)}
      Output generated: ${JSON.stringify(m.output).slice(0, 1500)}
      `).join("\n---\n")}

      Please synthesize this memory loop into a comprehensive, high-fidelity, and authoritative professional final markdown report.
      Format your response with clean headings, scannable lists, clear findings, and a definitive strategic conclusion.
      Return ONLY your final elegant markdown report inside the 'response' key of your JSON.
    `;

    let finalAnswer = "Ajan çalışmasının bulguları derlenemedi.";
    try {
      const res = await runTool("ai_think_tool", { prompt: synthesisPrompt, __apiKey: apiKey }, { apiKey });
      if (res.success && res.result?.response) {
        finalAnswer = String(res.result.response);
      }
    } catch (err: any) {
      logger.error("[Autonomous Agent] Sentez aşamasında hata:", err);
      finalAnswer = `
## 🤖 Autonomous Agent Raporu
Rapor oluşturulamadı. Adım izleme geçmişi:

${memory.map((m, idx) => `### Adım ${idx + 1}: ${steps[idx]}\n- **Input:** \`${JSON.stringify(m.input)}\`\n- **Output:** \`${JSON.stringify(m.output)}\``).join("\n\n")}
      `;
    }

    taskState.status = "completed";
    taskState.result = {
      goal,
      plan: steps,
      execution: memory.map((m, idx) => ({
        stepId: `step-${idx}`,
        toolId: taskState.steps[idx].toolId,
        input: m.input,
        output: m.output,
        success: taskState.steps[idx].status === "completed"
      })),
      finalAnswer
    };

    if (onProgress) onProgress({ ...taskState });
    return taskState.result;

  } catch (err: any) {
    logger.error("[Autonomous Agent] Genel hata:", err);
    taskState.status = "failed";
    taskState.steps = [
      { id: "error", description: `Ajan çalışması sırasında hata: ${err.message}`, status: "failed" }
    ];
    taskState.result = {
      goal,
      plan: [],
      execution: [],
      finalAnswer: `⚠️ **Ajan Hatası:** ${err.message || "Bilinmeyen bir hata oluştu."}`
    };

    if (onProgress) onProgress({ ...taskState });
    return taskState.result;
  }
}
