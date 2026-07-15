import { AgentTask, MemoryItem, AgentFinalOutput } from "./types";
import { planAgentTask, routeToolForStep } from "./planner";
import { runTool } from "../tools/runTool";

/**
 * Runs the autonomous agent executor loop:
 * Phase 1: Planning - Generates sequential steps using ai_think_tool
 * Phase 2: Execution Loop - Dynamically routes, chains, executes, and falls back
 */
export async function runAutonomousAgent(goal: string): Promise<AgentFinalOutput> {
  // Initialize the agent task state
  const task: AgentTask = {
    id: `agent-task-${Date.now()}`,
    goal,
    steps: [],
    currentStep: 0,
    results: [],
    status: "planning"
  };

  console.log(`[AGENT STARTED] Goal: ${goal}`);

  // Phase 1: Planning
  const steps = await planAgentTask(goal);
  task.steps = steps;
  task.status = "running";
  console.log(`[AGENT PLAN GENERATED]:`, steps);

  const memory: MemoryItem[] = [];

  // Phase 2: Execution Loop
  for (let i = 0; i < steps.length; i++) {
    task.currentStep = i;
    const step = steps[i];
    console.log(`[AGENT STEP ${i + 1}/${steps.length}]: ${step}`);

    // Dynamic routing decided by AI
    const toolId = await routeToolForStep(step, goal);
    console.log(`[AGENT ROUTING] Tool mapped: ${toolId}`);

    // Tool Chaining: Construct input utilizing previous session memory context
    let input: any = {};
    const contextSummary = memory.map((m) => `[Step ${m.step} Output]: ${JSON.stringify(m.output).slice(0, 1000)}`).join("\n");

    try {
      if (toolId === "web_search_tool") {
        // Optimize search query via AI using previous step contexts
        const optimizePrompt = `
          We are executing step: "${step}".
          The overall objective is: "${goal}".
          Our previous progress outputs:
          ${contextSummary || "None"}

          Formulate a precise search query (max 6-8 words) for Google to get relevant missing data.
          Response inside 'response' key MUST be just the search query string and nothing else.
        `;
        const res = await runTool("ai_think_tool", { prompt: optimizePrompt });
        const optimizedQuery = res.success && res.result?.response ? String(res.result.response).trim() : step;
        input = { query: optimizedQuery };
      } else if (toolId === "code_execution_tool") {
        // Generate javascript code via AI using previous findings
        const codePrompt = `
          We are executing step: "${step}".
          Previous context and findings:
          ${contextSummary || "None"}

          Generate a small, runnable Javascript snippet that processes/calculates or validates this step.
          Ensure to use console.log to print any final result.
          Return ONLY the javascript code, NO markdown blocks, NO explanations. Just raw JS code inside the 'response' key.
        `;
        const res = await runTool("ai_think_tool", { prompt: codePrompt });
        let code = res.success && res.result?.response ? String(res.result.response).trim() : `console.log("Processing step: ${step}");`;
        // Clean potential markdown blocks
        if (code.includes("```")) {
          code = code.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "").trim();
        }
        input = { code };
      } else if (toolId === "file_analysis_tool") {
        // Parse previous outputs as a file stream context
        input = { fileContent: `Step Action: ${step}\nCumulative Context:\n${contextSummary || "No previous files uploaded."}` };
      } else {
        // General deep thinking
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
      console.error("[AGENT INPUT CHAINING ERROR]", err);
      input = { prompt: step }; // fallback simple input
    }

    console.log(`[AGENT EXECUTING TOOL] ${toolId} with input:`, JSON.stringify(input).slice(0, 200));

    // Execute Tool with Error Handling and single Retry
    let success = false;
    let output: any = null;
    let errorMsg: string | undefined;

    try {
      let res = await runTool(toolId, input);
      if (res.success) {
        success = true;
        output = res.result;
      } else {
        errorMsg = res.error || "Tool returned success=false";
        console.warn(`[AGENT TOOL FAILED] Retrying step ${i + 1} with tool ${toolId} once... Error: ${errorMsg}`);
        
        // Single retry mechanism
        res = await runTool(toolId, input);
        if (res.success) {
          success = true;
          output = res.result;
        } else {
          errorMsg = res.error || "Tool returned success=false on retry";
        }
      }
    } catch (err: any) {
      errorMsg = err.message || "Execution exception";
      console.warn(`[AGENT TOOL EXCEPTION] Retrying step ${i + 1} with tool ${toolId} once...`);
      try {
        const res = await runTool(toolId, input);
        if (res.success) {
          success = true;
          output = res.result;
        }
      } catch (retryErr: any) {
        errorMsg = retryErr.message || "Execution exception on retry";
      }
    }

    // Fallback reasoning if both runs failed
    if (!success) {
      console.error(`[AGENT STEP FAILED PERMANENTLY] Continuing with fallback reasoning...`);
      const fallbackPrompt = `
        The tool "${toolId}" failed to execute the step "${step}".
        Error: ${errorMsg || "Unknown error"}.
        Goal: "${goal}".
        
        We have the following previous results in memory:
        ${contextSummary || "None"}

        Formulate a plausible logical analysis/output for this step despite the tool failure, so that we can proceed safely.
      `;
      try {
        const res = await runTool("ai_think_tool", { prompt: fallbackPrompt });
        if (res.success && res.result) {
          success = true;
          output = {
            fallback: true,
            reasoning: res.result.thinking || "Fallback completed.",
            response: res.result.response || "Continued with assumptions."
          };
        } else {
          output = { fallback: true, error: errorMsg, note: "Tool failure and fallback prompt failed." };
        }
      } catch (e: any) {
        output = { fallback: true, error: errorMsg, criticalError: e.message };
      }
    }

    // Save item to Memory
    memory.push({
      step: i,
      input,
      output
    });
  }

  // Final Output Synthesis
  console.log("[AGENT SYNTHESIZING FINAL ANSWER]");
  const synthesisPrompt = `
    You are the Master AI Coordinator of MUAH AI.
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

  let finalResult = "Unable to synthesize agent execution findings.";
  try {
    const res = await runTool("ai_think_tool", { prompt: synthesisPrompt });
    if (res.success && res.result?.response) {
      finalResult = String(res.result.response);
    }
  } catch (err: any) {
    console.error("[AGENT SYNTHESIS FAILED]", err);
    finalResult = `
## 🤖 Autonomous Agent Report
Failed to run final LLM synthesis. Here is the raw trace:

${memory.map((m, idx) => `### Step ${idx + 1}: ${steps[idx]}\n- **Input:** \`${JSON.stringify(m.input)}\`\n- **Output:** \`${JSON.stringify(m.output)}\``).join("\n\n")}
    `;
  }

  return {
    goal,
    plan: steps,
    memory,
    finalResult
  };
}
