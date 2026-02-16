export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'critical';

export interface ConnectionStats {
  latency: number; // Current RTT
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  quality: ConnectionQuality;
}

export class ConnectionMonitor {
  private pingInterval: number = 2000; // 2 seconds
  private pings: Map<number, number> = new Map(); // timestamp -> sent time
  private latencyHistory: number[] = []; // last 10 pings
  private historySize: number = 10;
  private subscribers: Set<(stats: ConnectionStats) => void> = new Set();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private sendPingCallback: (timestamp: number) => void;

  constructor(sendPingCallback: (timestamp: number) => void) {
    this.sendPingCallback = sendPingCallback;
  }

  startMonitoring(): void {
    if (this.intervalHandle) return; // Already monitoring

    this.intervalHandle = setInterval(() => {
      const timestamp = Date.now();
      this.pings.set(timestamp, timestamp);
      this.sendPingCallback(timestamp);

      // Clean up old pings (> 30 seconds)
      const cutoff = timestamp - 30000;
      for (const [ts] of this.pings) {
        if (ts < cutoff) {
          this.pings.delete(ts);
        }
      }
    }, this.pingInterval);
  }

  stopMonitoring(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.pings.clear();
    this.latencyHistory = [];
  }

  onPong(timestamp: number, _serverTime?: number): void {
    const sentTime = this.pings.get(timestamp);
    if (!sentTime) return; // Stale pong

    const latency = Date.now() - sentTime;
    this.latencyHistory.push(latency);

    if (this.latencyHistory.length > this.historySize) {
      this.latencyHistory.shift();
    }

    this.pings.delete(timestamp);
    this.notifySubscribers();
  }

  getStats(): ConnectionStats | null {
    if (this.latencyHistory.length === 0) return null;

    const latency = this.latencyHistory[this.latencyHistory.length - 1];
    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    const minLatency = Math.min(...this.latencyHistory);
    const maxLatency = Math.max(...this.latencyHistory);
    const quality = this.calculateQuality(avgLatency);

    return { latency, avgLatency, minLatency, maxLatency, quality };
  }

  private calculateQuality(avgLatency: number): ConnectionQuality {
    if (avgLatency < 50) return 'excellent';
    if (avgLatency < 100) return 'good';
    if (avgLatency < 200) return 'poor';
    return 'critical';
  }

  subscribe(callback: (stats: ConnectionStats) => void): () => void {
    this.subscribers.add(callback);
    // Send current stats immediately
    const stats = this.getStats();
    if (stats) callback(stats);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const stats = this.getStats();
    if (stats) {
      this.subscribers.forEach(cb => cb(stats));
    }
  }
}
