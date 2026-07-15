export type ProviderId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "nvidia"
  | "groq"
  | "mistral"
  | "cohere"
  | "xai"
  | "openrouter"
  | "together"
  | "ollama"
  | "lmstudio"
  | "huggingface"
  | string; // Add string to allow fallback for any other providers

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  logo: string;
  apiKeyPlaceholder: string;
  apiKeyRegex?: string;
  hasKey: boolean;
  color: string;
}

export type ModelCategory = "text" | "code" | "vision" | "audio" | "embedding" | "image_gen";

export interface ModelCapabilities {
  functionCalling: boolean;
  vision: boolean;
  streaming: boolean;
  jsonMode: boolean;
}

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  currency: string;
}

export interface ModelHealth {
  lastSuccess?: string;
  lastFailure?: string;
  consecutiveFailures: number;
  avgLatencyMs: number;
  successRate: number; // Percentage
}

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  displayName: string;
  category: ModelCategory[];
  contextWindow: number; // in tokens
  maxOutputTokens: number;
  pricing: ModelPricing;
  isFree?: boolean;
  capabilities: ModelCapabilities;
  status: "active" | "inactive" | "deprecated" | "rate_limited";
  health: ModelHealth;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  modelId?: string; // Which model responded
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number; // USD
  latencyMs?: number;
  reasoning?: string; // Thinking process (e.g. DeepSeek-R1 style)
  isStreaming?: boolean;
  error?: string;
  routingReason?: string;
  fallbackTriggered?: boolean;
  warning?: string;
  compactedHistory?: boolean;
  appliedParams?: {
    temperature: number;
    maxTokens: number;
    aiMode: string;
    effortLevel: string;
  };
  agentTask?: any; // To hold real-time AIAgentTask state
  toolCalls?: {
    toolId: string;
    toolName: string;
    input: any;
    output: any;
    success: boolean;
    latencyMs: number;
  }[];
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  status: "queued" | "parsing" | "ready" | "error";
  content?: string;
  pageCount?: number;
  lineCount?: number;
  error?: string;
}

export interface CrewAgent {
  id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  tools: string[];
  status: "idle" | "thinking" | "executing" | "done" | "error";
  thoughts?: string;
}

export interface CrewTask {
  id: string;
  description: string;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
  logs: string[];
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  activeModelIds: string[];
  fileIds: string[];
  budgetLimit: number; // USD
  currentSpend: number; // USD
  createdAt: string;
}

// === FIM / Sekme Tamamlama Tipleri ===
export interface FIMConfig {
  enabled: boolean;
  debounceMs: number;
  maxSuggestionLength: number;
  provider: string;
  model: string;
  temperature: number;
}

export interface FIMSuggestion {
  prefix: string;
  suffix: string;
  completion: string;
  language: string;
  confidence: number;
}

// === Satır İçi Düzenleme (Inline Edit - Cmd+K) Tipleri ===
export interface InlineEditRequest {
  selectedCode: string;
  instruction: string;
  language: string;
  filePath?: string;
  lineStart: number;
  lineEnd: number;
}

export interface InlineEditResult {
  original: string;
  suggested: string;
  explanation: string;
  accepted: boolean;
}

// === Kod Tabanı Semantik İndeksleme Tipleri ===
export interface CodebaseChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  embedding?: number[];
  score?: number;
}

export interface CodebaseIndex {
  projectId: string;
  lastIndexed: string;
  totalFiles: number;
  totalChunks: number;
}

export interface CodebaseSearchResult {
  chunks: CodebaseChunk[];
  query: string;
  totalResults: number;
}

// === Git Entegrasyonu Tipleri ===
export interface GitFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '?' | 'U';
  oldPath?: string;
}

export interface GitStatus {
  branch: string;
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
  ahead: number;
  behind: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface GitDiff {
  filePath: string;
  additions: number;
  deletions: number;
  hunks: GitHunk[];
}

export interface GitHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: { type: '+' | '-' | ' '; content: string }[];
}

// === Proje Kuralları Tipleri ===
export type RuleTrigger = 'always' | 'auto' | 'agent_requested' | 'manual';

export interface ProjectRule {
  id: string;
  name: string;
  description: string;
  content: string;
  trigger: RuleTrigger;
  globPattern?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface RulesConfig {
  globalRules: ProjectRule[];
  projectRules: ProjectRule[];
  activeRuleIds: string[];
}

// === Otomasyon Sistemi Tipleri ===
export type AutomationTriggerType = 'schedule' | 'file_change' | 'manual' | 'on_save' | 'on_commit';

export interface AutomationTrigger {
  type: AutomationTriggerType;
  cron?: string;
  watchPath?: string;
  branch?: string;
  filePattern?: string;
}

export interface AutomationAction {
  type: 'ai_task' | 'run_command' | 'send_notification';
  prompt?: string;
  model?: string;
  provider?: string;
  command?: string;
  message?: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  lastRun?: string;
  lastResult?: string;
  lastStatus?: 'success' | 'failed' | 'running';
  runCount: number;
  createdAt: string;
}

// === BugBot / Kod İnceleme Tipleri ===
export type IssueCategory = 'bug' | 'security' | 'performance' | 'style' | 'suggestion';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CodeIssue {
  id: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion?: string;
  fixedCode?: string;
  isFixed: boolean;
  isIgnored: boolean;
}

export interface ReviewResult {
  filePath: string;
  issues: CodeIssue[];
  score: number;
  summary: string;
  reviewedAt: string;
  model: string;
}

// === Prompt Kütüphanesi Tipleri ===
export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  isBuiltIn: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// === Oturum Dışa Aktarma Tipleri ===
export interface SessionExport {
  version: string;
  exportedAt: string;
  sessions: ChatSession[];
  rules?: ProjectRule[];
  automations?: Automation[];
  memory?: any;
}

// === Bağlam Penceresi Görselleştirici Tipleri ===
export interface ContextWindowState {
  totalTokens: number;
  usedTokens: number;
  modelLimit: number;
  warningThreshold: number;
  breakdown: {
    systemPrompt: number;
    memory: number;
    rules: number;
    history: number;
    files: number;
    currentMessage: number;
  };
}

// === Yerel Klasör Senkronizasyon Tipleri ===
export interface LocalFolderSync {
  isConnected: boolean;
  rootPath: string;
  lastSynced?: string;
  watchedFiles: string[];
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isActive: boolean;
  fetchedModels?: string[];
}
