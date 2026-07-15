import { logger } from "../utils/systemLogger";
import { resilience } from "../utils/resilience";

export interface MemoryEntry {
  id: string;
  category: "preference" | "fact" | "rule" | "project";
  content: string;
  timestamp: string;
  tags: string[];
}

const MAX_MEMORIES = 100;

class CognitiveMemoryStore {
  private memories: MemoryEntry[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.memories = resilience.storage.get<MemoryEntry[]>("memories", []);
  }

  private saveToLocal() {
    // Limit memory size to prevent performance degradation
    if (this.memories.length > MAX_MEMORIES) {
      this.memories = this.memories.slice(-MAX_MEMORIES);
      logger.info(`[Memory] Pruning oldest memories to maintain limit of ${MAX_MEMORIES}`);
    }
    
    resilience.storage.set("memories", this.memories);
    this.notify();
  }

  public addMemory(content: string, category: MemoryEntry["category"] = "fact", tags: string[] = []) {
    // Avoid duplicates
    const isDuplicate = this.memories.some(m => m.content === content && m.category === category);
    if (isDuplicate) return;

    const newEntry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      category,
      content,
      timestamp: new Date().toISOString(),
      tags
    };
    this.memories.push(newEntry);
    this.saveToLocal();
    logger.info(`[Memory] Yeni bellek eklendi (${category}): ${content.substring(0, 30)}...`);
  }

  public removeMemory(id: string) {
    this.memories = this.memories.filter(m => m.id !== id);
    this.saveToLocal();
  }

  public getMemories() {
    return this.memories;
  }

  public getContextString() {
    if (this.memories.length === 0) return "";
    const coreMemories = this.memories.map(m => `- [${m.category.toUpperCase()}]: ${m.content}`).join("\n");
    return `\n\n### 🧠 Bilişsel Bellek (Kritik Bilgiler):\n${coreMemories}`;
  }

  public subscribe(l: () => void) {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter(i => i !== l); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const memoryStore = new CognitiveMemoryStore();
