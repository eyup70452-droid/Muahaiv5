import fs from 'fs';
import path from 'path';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  priority: number;
  qualityScore: number;
  successCount: number;
  failCount: number;
  longTermMemory: string[]; // Learnings from past tasks
}

const PROFILES_FILE = path.join(process.cwd(), 'tmp', 'agent_profiles.json');

export class AgentProfileManager {
  static init() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    if (!fs.existsSync(PROFILES_FILE)) {
      const defaultProfiles: Record<string, AgentProfile> = {
        'coder-primary': { id: 'coder-primary', name: 'GPT-Coder-Alpha', role: 'coder', expertise: ['typescript', 'react', 'refactoring'], priority: 10, qualityScore: 85, successCount: 0, failCount: 0, longTermMemory: [] },
        'coder-fallback': { id: 'coder-fallback', name: 'GPT-Coder-Beta', role: 'coder', expertise: ['javascript', 'debugging', 'python'], priority: 5, qualityScore: 70, successCount: 0, failCount: 0, longTermMemory: [] },
        'researcher-primary': { id: 'researcher-primary', name: 'Gemini-Research-One', role: 'researcher', expertise: ['web-search', 'data-mining', 'summarization'], priority: 10, qualityScore: 80, successCount: 0, failCount: 0, longTermMemory: [] },
        'analyzer-primary': { id: 'analyzer-primary', name: 'Claude-Analyzer', role: 'analyzer', expertise: ['architecture', 'security', 'static-analysis'], priority: 10, qualityScore: 90, successCount: 0, failCount: 0, longTermMemory: [] },
        'critic-primary': { id: 'critic-primary', name: 'Critic-X', role: 'critic', expertise: ['code-review', 'qa', 'feedback'], priority: 10, qualityScore: 85, successCount: 0, failCount: 0, longTermMemory: [] }
      };
      fs.writeFileSync(PROFILES_FILE, JSON.stringify(defaultProfiles, null, 2));
    }
  }

  static getProfiles(): Record<string, AgentProfile> {
    this.init();
    try {
      return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }

  static saveProfiles(profiles: Record<string, AgentProfile>) {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
  }

  static getAgentsByRole(role: string): AgentProfile[] {
    const profiles = this.getProfiles();
    return Object.values(profiles)
      .filter(p => p.role === role)
      .sort((a, b) => {
        // Sort by priority first, then quality score
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.qualityScore - a.qualityScore;
      });
  }

  static recordSuccess(agentId: string, learning?: string) {
    const profiles = this.getProfiles();
    if (profiles[agentId]) {
      profiles[agentId].successCount++;
      profiles[agentId].qualityScore = Math.min(100, profiles[agentId].qualityScore + 2);
      if (learning) {
        profiles[agentId].longTermMemory.push(learning);
        if (profiles[agentId].longTermMemory.length > 20) profiles[agentId].longTermMemory.shift();
      }
      this.saveProfiles(profiles);
    }
  }

  static recordFailure(agentId: string) {
    const profiles = this.getProfiles();
    if (profiles[agentId]) {
      profiles[agentId].failCount++;
      profiles[agentId].qualityScore = Math.max(0, profiles[agentId].qualityScore - 5);
      // Decrease priority if score drops too low
      if (profiles[agentId].qualityScore < 50) {
        profiles[agentId].priority = Math.max(1, profiles[agentId].priority - 1);
      }
      this.saveProfiles(profiles);
    }
  }
}
