/**
 * Client-side bridge for the multi-agent Swarm task.
 * Routes the user goal to the backend endpoint '/api/swarm/run'.
 */
export async function runSwarmTask(
  goal: string,
  options: {
    onProgress?: (task: any) => void;
  } = {}
): Promise<any> {
  const { onProgress } = options;

  // Initialize progress state
  const task: any = {
    id: `swarm-task-${Date.now()}`,
    goal,
    steps: [
      { id: "swarm-planning", description: "Swarm Planner Agent is distributing tasks...", status: "running" }
    ],
    status: "running"
  };

  if (onProgress) onProgress({ ...task });

  try {
    const { getApiKeys } = await import("../../lib/encryption.js");
    const keysObj = getApiKeys();
    const apiKey = keysObj["openai"] || keysObj["openrouter"] || keysObj["anthropic"] || keysObj["google"]; // Best effort fallback
    const response = await fetch("/api/swarm/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ taskDescription: goal, apiKey })
    });

    if (!response.ok) {
      throw new Error(`Swarm run failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Swarm execution failed on the backend.");
    }

    const { agentResults, finalOutput } = data;

    // Build the execution list for the UI
    const execution = [
      { stepId: "planner", toolId: "ai_think_tool", input: "Plan subtasks", output: agentResults.planner, success: true },
      { stepId: "researcher", toolId: "web_search_tool", input: agentResults.planner?.researcherTask, output: agentResults.researcher, success: true },
      { stepId: "coder", toolId: "code_execution_tool", input: agentResults.planner?.coderTask, output: agentResults.coder, success: true },
      { stepId: "analyzer", toolId: "ai_think_tool", input: agentResults.planner?.analyzerTask, output: agentResults.analyzer, success: true },
      { stepId: "critic", toolId: "ai_think_tool", input: "Validate outputs", output: agentResults.critic, success: true },
      { stepId: "validator", toolId: "system_validation", input: "Run lint & dependency check", output: agentResults.validator, success: agentResults.validator?.valid },
      { stepId: "finalizer", toolId: "ai_think_tool", input: "Synthesize report", output: agentResults.finalizer, success: true },
    ];

    task.status = "completed";
    task.steps = [
      { id: "swarm-planning", toolId: "planner", description: "Swarm Planner Agent finished", status: "completed", output: agentResults.planner },
      { id: "swarm-execution", toolId: "researcher/coder/analyzer", description: "Parallel Execution completed", status: "completed", output: { researcher: agentResults.researcher, coder: agentResults.coder, analyzer: agentResults.analyzer } },
      { id: "swarm-critic", toolId: "critic", description: "Critic evaluated results", status: "completed", output: agentResults.critic },
      { id: "swarm-validator", toolId: "validator", description: "Merge & Validation completed", status: "completed", output: agentResults.validator },
      { id: "swarm-finalizer", toolId: "finalizer", description: "Finalizer synthesized output", status: "completed", output: agentResults.finalizer }
    ];

    task.result = {
      goal,
      execution,
      finalAnswer: finalOutput
    };

    if (onProgress) onProgress({ ...task });
    return task.result;

  } catch (err: any) {
    task.status = "failed";
    task.steps = [
      { id: "error", description: `Swarm execution failed: ${err.message}`, status: "failed" as const }
    ];
    task.result = {
      goal,
      execution: [],
      finalAnswer: `⚠️ **Swarm Hatası:** ${err.message || "Bilinmeyen bir hata oluştu."}`
    };

    if (onProgress) onProgress({ ...task });
    return task.result;
  }
}
