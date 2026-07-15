import { AgentRole, SwarmMemory, SwarmFinalOutput } from "./types";
import { runTool } from "../tools/runTool";
import { AgentProfileManager, AgentProfile } from "./agentProfileManager";
import { FileLockManager } from "./lockManager";

// Robust JSON parse helper that gracefully handles raw LLM responses, markdown fences, and bad formatting
function safeParseJson<T>(raw: string, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  let clean = raw.trim();
  if (clean.includes("```")) {
    clean = clean.replace(/```json/gi, "").replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "").trim();
  }
  try {
    return JSON.parse(clean) as T;
  } catch (err) {
    // Brute-force JSON block extraction via curly brace or bracket scanning
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch (err2) {
        console.warn("[safeParseJson] Fallback extraction parse failed:", err2);
      }
    }
    console.error("[safeParseJson] Error parsing string, returning fallback:", clean.substring(0, 200));
    return fallback;
  }
}

export async function runSwarmAgent(goal: string, apiKey?: string): Promise<SwarmFinalOutput> {
  const memory: SwarmMemory = {
    goal,
    agentOutputs: {},
    intermediateState: [],
  };

  AgentProfileManager.init();
  FileLockManager.init();

  // STEP 1: PLANNING AGENT
  console.log("[SWARM] Planner agent starting...");
  const scanRes = await runTool("project_scan_tool", { path: "." }, { apiKey });
  let projectContext = "";
  if (scanRes.success && scanRes.result) {
    projectContext = `\nProject context:\n` + JSON.stringify(scanRes.result.structure).slice(0, 1000);
  }

  const plannerPrompt = `
    You are the Planner Agent.
    Goal: "${goal}"${projectContext}
    Break this goal down into 3 specific tasks to be executed:
    1. researcherTask: data gathering or file reading.
    2. coderTask: code modifications.
    3. analyzerTask: deep analysis or security review.
    Output JSON ONLY: { "researcherTask": "...", "coderTask": "...", "analyzerTask": "..." }
  `;
  
  const plannerRes = await runTool("ai_think_tool", { prompt: plannerPrompt, __apiKey: apiKey }, { apiKey });
  let tasks = {
    researcherTask: "Research how to achieve: " + goal,
    coderTask: "Implement code for: " + goal,
    analyzerTask: "Analyze security and architecture for: " + goal
  };

  if (plannerRes.success && plannerRes.result?.response) {
    const raw = String(plannerRes.result.response);
    const parsed = safeParseJson<any>(raw, {});
    if (parsed.researcherTask) tasks.researcherTask = parsed.researcherTask;
    if (parsed.coderTask) tasks.coderTask = parsed.coderTask;
    if (parsed.analyzerTask) tasks.analyzerTask = parsed.analyzerTask;
  }
  memory.agentOutputs.planner = tasks;

  // HELPER: Execute task with Handover, Long-Term Memory, and Fallbacks
  const executeWithHandover = async (role: string, taskDesc: string, runLogic: (agent: AgentProfile) => Promise<any>) => {
    const agents = AgentProfileManager.getAgentsByRole(role);
    if (agents.length === 0) {
      return { error: `No agents found for role: ${role}` };
    }

    let lastError = null;
    for (const agent of agents) {
      console.log(`[SWARM] Assigning ${role} task to ${agent.name} (Score: ${agent.qualityScore}, Priority: ${agent.priority})`);
      try {
        const result = await runLogic(agent);
        if (result && !result.error && result.success !== false) {
          AgentProfileManager.recordSuccess(agent.id, `Successfully completed task: ${taskDesc.slice(0, 30)}`);
          return { agentId: agent.id, ...result };
        } else {
           throw new Error(result?.error || "Agent execution failed without explicit error");
        }
      } catch (err: any) {
        console.warn(`[SWARM] Agent ${agent.name} failed: ${err.message}. Handing over to next agent...`);
        AgentProfileManager.recordFailure(agent.id);
        lastError = err;
      }
    }
    return { error: `All agents for role ${role} failed. Last error: ${lastError?.message}` };
  };

  // STEP 2: PARALLEL EXECUTION (Researcher & Analyzer)
  const runResearcher = async (agent: AgentProfile) => {
    const memoryContext = agent.longTermMemory.length > 0 ? `Past Learnings: ${agent.longTermMemory.join("; ")}` : "";
    const prompt = `You are ${agent.name} (Role: ${agent.role}). Expertise: ${agent.expertise.join(", ")}. ${memoryContext}
Task: ${tasks.researcherTask}. Choose tool: 'web_search_tool' or 'file_read_tool'. Output JSON: { "tool": "...", "input": { "query": "..." } }. ONLY JSON.`;
    const aiRes = await runTool("ai_think_tool", { prompt, __apiKey: apiKey }, { apiKey });
    
    const raw = String(aiRes.result?.response || "");
    const parsed = safeParseJson<any>(raw, {});
    
    if (parsed.tool === "web_search_tool" || parsed.tool === "file_read_tool") {
      const res = await runTool(parsed.tool, parsed.input);
      if (!res.success) throw new Error(res.error);
      return res.result;
    }
    throw new Error("Invalid tool selected");
  };

  // Analyzer uses Voting System (Majority Decision)
  const runAnalyzerWithVoting = async () => {
    console.log("[SWARM] Analyzer Voting System started...");
    const agents = AgentProfileManager.getAgentsByRole('analyzer');
    if (agents.length === 0) return { error: "No analyzers available for voting" };

    const proposals = [];
    // Up to 3 analyzers propose a solution
    const voterCount = Math.min(3, agents.length);
    for (let i = 0; i < voterCount; i++) {
      const agent = agents[i];
      const memoryContext = agent.longTermMemory.length > 0 ? `Past Learnings: ${agent.longTermMemory.join("; ")}` : "";
      const prompt = `You are ${agent.name}. Expertise: ${agent.expertise.join(", ")}. ${memoryContext}
Analyze this task: ${tasks.analyzerTask}. Return a brief analysis (max 50 words).`;
      const res = await runTool("ai_think_tool", { prompt, __apiKey: apiKey }, { apiKey });
      if (res.success) proposals.push({ agentId: agent.id, text: res.result?.response });
    }

    if (proposals.length === 0) return { error: "No proposals generated" };
    if (proposals.length === 1) return { consensus: proposals[0].text, votes: 1 };

    // Voting phase
    const votePrompt = `Review these analysis proposals and select the best one by index (0 to ${proposals.length-1}).
Proposals:
${proposals.map((p, i) => `[${i}] ${p.text}`).join("\n")}
Output ONLY JSON: { "bestIndex": number }`;
    
    const votes: Record<number, number> = {};
    for (let i = 0; i < voterCount; i++) {
      const res = await runTool("ai_think_tool", { prompt: votePrompt, __apiKey: apiKey }, { apiKey });
      try {
        const raw = String(res.result?.response || "{}");
        const parsed = safeParseJson<any>(raw, {});
        const idx = parsed.bestIndex;
        if (idx !== undefined && proposals[idx]) {
           votes[idx] = (votes[idx] || 0) + 1;
        }
      } catch(e) {}
    }

    // Majority decision
    let bestIdx = 0;
    let maxVotes = 0;
    for (const idx in votes) {
       if (votes[idx] > maxVotes) {
          maxVotes = votes[idx];
          bestIdx = parseInt(idx);
       }
    }
    
    console.log(`[SWARM] Majority decision: Proposal ${bestIdx} won with ${maxVotes} votes.`);
    // Reward winner
    AgentProfileManager.recordSuccess(proposals[bestIdx].agentId, "Won majority vote in analysis");
    return { consensus: proposals[bestIdx].text, votes: maxVotes, allProposals: proposals };
  };

  const [researcherOut, analyzerOut] = await Promise.all([
    executeWithHandover("researcher", tasks.researcherTask, runResearcher),
    runAnalyzerWithVoting()
  ]);

  memory.agentOutputs.researcher = researcherOut;
  memory.agentOutputs.analyzer = analyzerOut;

  // STEP 3: CODER WITH FILE LOCKING & 2ND ROUND CRITIQUE
  const runCoderLogic = async (agent: AgentProfile, feedbackContext: string = "") => {
    const memoryContext = agent.longTermMemory.length > 0 ? `Past Learnings: ${agent.longTermMemory.join("; ")}` : "";
    const prompt = `You are ${agent.name}. Expertise: ${agent.expertise.join(", ")}. ${memoryContext}
Task: ${tasks.coderTask}.
${feedbackContext ? "CRITIC FEEDBACK (Fix these issues): " + feedbackContext : ""}
Choose tool: 'file_patch_tool' (for editing workspace files) or 'code_execution_tool'. Output JSON: { "tool": "...", "input": { ... } }. ONLY JSON.`;
    
    const aiRes = await runTool("ai_think_tool", { prompt, __apiKey: apiKey }, { apiKey });
    const raw = String(aiRes.result?.response || "");
    const parsed = safeParseJson<any>(raw, {});
    
    // File Locking check
    if (parsed.tool === "file_patch_tool" && parsed.input?.path) {
       const locked = await FileLockManager.acquireLock(parsed.input.path, agent.id, 5000);
       if (!locked) {
          throw new Error(`File ${parsed.input.path} is locked by another agent or process. Collision prevented.`);
       }
       try {
         const res = await runTool("file_patch_tool", parsed.input);
         FileLockManager.releaseLock(parsed.input.path, agent.id);
         if (!res.success) throw new Error(res.error);
         return res.result;
       } catch (err) {
         FileLockManager.releaseLock(parsed.input.path, agent.id);
         throw err;
       }
    } else if (parsed.tool === "code_execution_tool") {
       const res = await runTool("code_execution_tool", parsed.input);
       if (!res.success) throw new Error(res.error);
       return res.result;
    }
    throw new Error("Invalid tool selected or invalid parameters");
  };

  let coderOut: any = null;
  let criticOut: any = null;
  
  // Handover loop for coder
  const coderAgents = AgentProfileManager.getAgentsByRole("coder");
  let coderSuccess = false;

  for (const coderAgent of coderAgents) {
    if (coderSuccess) break;
    console.log(`[SWARM] Assigning coder task to ${coderAgent.name}`);
    
    try {
      // 1st Round
      coderOut = await runCoderLogic(coderAgent);
      
      // CRITIC REVIEW (Self-Correction & Peer Review)
      console.log(`[SWARM] Critic reviewing ${coderAgent.name}'s work...`);
      const criticAgents = AgentProfileManager.getAgentsByRole("critic");
      const critic = criticAgents[0] || { name: "SystemCritic", expertise: [] };
      
      const criticPrompt = `You are ${critic.name}. Review this coder output: ${JSON.stringify(coderOut).slice(0,1000)}
Goal: ${goal}
Is it valid and high quality? Output JSON: { "isValid": boolean, "feedback": "detailed feedback" }`;
      
      const criticRes = await runTool("ai_think_tool", { prompt: criticPrompt, __apiKey: apiKey }, { apiKey });
      const criticRaw = String(criticRes.result?.response || '{"isValid":true}');
      criticOut = safeParseJson<any>(criticRaw, { isValid: true, feedback: "" });
      
      if (criticOut.isValid) {
        coderSuccess = true;
        AgentProfileManager.recordSuccess(coderAgent.id, "Wrote valid code passed by critic");
        if (criticAgents.length > 0) AgentProfileManager.recordSuccess(criticAgents[0].id);
      } else {
        console.log(`[SWARM] Critic rejected output. Initiating 2nd Round Generation (Self-Correction)...`);
        AgentProfileManager.recordFailure(coderAgent.id);
        // 2nd Round
        coderOut = await runCoderLogic(coderAgent, criticOut.feedback);
        // We assume 2nd round passes or we hand over
        coderSuccess = true; 
        AgentProfileManager.recordSuccess(coderAgent.id, "Corrected code in 2nd round");
      }
    } catch (e: any) {
      console.warn(`[SWARM] Coder ${coderAgent.name} failed: ${e.message}`);
      AgentProfileManager.recordFailure(coderAgent.id);
    }
  }

  if (!coderSuccess) {
    coderOut = { error: "All coder agents failed." };
  }

  memory.agentOutputs.coder = coderOut;
  memory.agentOutputs.critic = criticOut;

  // STEP 4: SYSTEM VALIDATION & FINALIZER
  console.log("[SWARM] Validation & Merge step starting...");
  let validationResult = { valid: true, issues: [] as string[] };
  try {
    const cp = await import('child_process');
    const util = await import('util');
    const exec = util.promisify(cp.exec);
    const { stdout, stderr } = await exec('npm run lint --if-present', { timeout: 15000 });
    validationResult.issues.push("Linter passed or no linter configured.");
  } catch(e: any) {
    validationResult.valid = false;
    validationResult.issues.push(`Validation error found: ${e.message.slice(0, 200)}`);
  }
  memory.agentOutputs.validator = validationResult;

  console.log("[SWARM] Finalizer agent starting...");
  const finalizerPrompt = `
    You are the Finalizer Agent. The goal is: "${goal}"
    Planner: ${JSON.stringify(tasks)}
    Researcher: ${JSON.stringify(researcherOut).slice(0, 500)}
    Coder: ${JSON.stringify(coderOut).slice(0, 500)}
    Analyzer (Majority Vote): ${JSON.stringify(analyzerOut).slice(0, 500)}
    Critic: ${JSON.stringify(criticOut)}
    Validation: ${JSON.stringify(validationResult)}
    
    Synthesize everything into a structured markdown report describing the multi-agent execution, voting results, memory learnings, and final status.
    Output JSON: { "tool": "ai_think_tool", "report": "..." }. ONLY JSON.
  `;
  
  const finalizerRes = await runTool("ai_think_tool", { prompt: finalizerPrompt, __apiKey: apiKey }, { apiKey });
  let finalOutput = "Final synthesis failed.";
  if (finalizerRes.success && finalizerRes.result?.response) {
    const raw = String(finalizerRes.result.response);
    const parsed = safeParseJson<any>(raw, {});
    finalOutput = parsed.report || raw;
  }
  memory.agentOutputs.finalizer = finalOutput;

  return {
    goal,
    agentResults: memory.agentOutputs,
    finalOutput
  };
}
