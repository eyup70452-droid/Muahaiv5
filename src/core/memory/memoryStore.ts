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
    this.syncWithServer();
  }

  public async syncWithServer() {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        if (data && data.facts) {
          const serverFacts = data.facts.map((f: any) => ({
            id: f.id || `mem-srv-${Date.now()}-${Math.random()}`,
            category: "fact" as const,
            content: f.text,
            timestamp: f.timestamp || new Date().toISOString(),
            tags: f.tags || []
          }));
          
          const merged = [...this.memories];
          serverFacts.forEach((sf: any) => {
            const exists = merged.some(m => m.content === sf.content);
            if (!exists) {
              merged.push(sf);
            }
          });
          
          this.memories = merged;
          resilience.storage.set("memories", this.memories);
          this.notify();
        }
      }
    } catch (err) {
      logger.error(`[Memory Sync] Failed to sync memories with server:`, err);
    }
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

    // Sync to server API asynchronously
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: content })
    }).catch(err => logger.error(`[Memory Sync] Error syncing memory to server:`, err));
  }

  public removeMemory(id: string) {
    const found = this.memories.find(m => m.id === id);
    this.memories = this.memories.filter(m => m.id !== id);
    this.saveToLocal();

    if (found) {
      fetch("/api/memory/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: found.content })
      }).catch(err => logger.error(`[Memory Sync] Error removing memory from server:`, err));
    }
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
