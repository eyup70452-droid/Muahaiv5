export type AgentRole =
  | "planner"
  | "researcher"
  | "coder"
  | "analyzer"
  | "critic"
  | "validator"
  | "finalizer";

export interface SwarmMemory {
  goal: string;
  agentOutputs: Partial<Record<AgentRole, any>>;
  intermediateState: any[];
}

export interface SwarmFinalOutput {
  goal: string;
  agentResults: Record<string, any>;
  finalOutput: string;
}
