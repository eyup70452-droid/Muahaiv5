/**
 * Client-side bridge for the real multi-step autonomous AI Agent task.
 * Routes the user goal to the backend endpoint '/api/agent/run' where the plan is generated,
 * tools are routed dynamically via AI, executed, and results are compiled into a final report.
 */
export async function runAgentTask(
  goal: string,
  options: {
    files?: any[];
    onProgress?: (task: any) => void;
    modelId?: string;
    providerId?: string;
    customApiKey?: string;
  } = {}
): Promise<any> {
  const { onProgress } = options;

  // Initialize progress state
  const task: any = {
    id: `task-${Date.now()}`,
    goal,
    steps: [
      { id: "planning-step", description: "AI Orchestrator is planning sequential steps and routing tools...", status: "running" }
    ],
    status: "running"
  };

  if (onProgress) onProgress({ ...task });

  try {
    const response = await fetch("/api/agent/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ goal })
    });

    if (!response.ok) {
      throw new Error(`Agent run failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Execution failed on the backend.");
    }

    const { plan, memory, finalResult } = data;

    // Map plan & execution history to completion state
    task.status = "completed";
    task.steps = (plan || []).map((p: string, idx: number) => ({
      id: `step-${idx}`,
      description: p,
      status: "completed" as const
    }));

    task.result = {
      goal,
      plan,
      execution: (memory || []).map((m: any, idx: number) => ({
        stepId: `step-${idx}`,
        toolId: `tool-${idx}`,
        input: m.input,
        output: m.output,
        success: true
      })),
      finalAnswer: finalResult
    };

    if (onProgress) onProgress({ ...task });
    return task.result;

  } catch (err: any) {
    task.status = "failed";
    task.steps = [
      { id: "error", description: `Task execution failed: ${err.message}`, status: "failed" as const }
    ];
    task.result = {
      goal,
      plan: [],
      execution: [],
      finalAnswer: `⚠️ **Ajan Hatası:** ${err.message || "Bilinmeyen bir hata oluştu."}`
    };

    if (onProgress) onProgress({ ...task });
    return task.result;
  }
}
