export interface AgentTask {
  id: string;
  goal: string;
  steps: string[];
  currentStep: number;
  results: any[];
  status: "idle" | "planning" | "running" | "completed" | "failed";
}

export interface MemoryItem {
  step: number;
  input: any;
  output: any;
}

export interface AgentFinalOutput {
  goal: string;
  plan: string[];
  memory: MemoryItem[];
  finalResult: string;
}
