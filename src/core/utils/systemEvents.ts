type SystemEvent = {
  type: "routing" | "memory" | "agent" | "system";
  message: string;
  data?: any;
  timestamp: string;
};

type Listener = (event: SystemEvent) => void;

class SystemEvents {
  private listeners: Listener[] = [];
  private history: SystemEvent[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(type: SystemEvent["type"], message: string, data?: any) {
    const event: SystemEvent = {
      type,
      message,
      data,
      timestamp: new Date().toLocaleTimeString()
    };
    this.history.push(event);
    if (this.history.length > 50) this.history.shift();
    this.listeners.forEach(l => l(event));
  }

  getHistory() {
    return this.history;
  }
}

export const systemEvents = new SystemEvents();
