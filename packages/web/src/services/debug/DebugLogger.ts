export interface DebugEvent {
  timestamp: number;
  direction: 'in' | 'out';
  type: string;
  data: any;
}

export class DebugLogger {
  private events: DebugEvent[] = [];
  private subscribers: Set<(events: DebugEvent[]) => void> = new Set();
  private maxEvents: number = 500;

  logIncoming(data: any): void {
    this.addEvent({ timestamp: Date.now(), direction: 'in', type: data.type, data });
  }

  logOutgoing(data: any): void {
    this.addEvent({ timestamp: Date.now(), direction: 'out', type: data.type, data });
  }

  private addEvent(event: DebugEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift(); // Keep only last maxEvents
    }
    this.notify();
  }

  subscribe(callback: (events: DebugEvent[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    this.subscribers.forEach(cb => cb([...this.events]));
  }

  getEvents(): DebugEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
    this.notify();
  }

  setMaxEvents(max: number): void {
    this.maxEvents = max;
  }

  exportToJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }
}
