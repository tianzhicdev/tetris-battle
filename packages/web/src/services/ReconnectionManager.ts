export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

export interface ReconnectionCallbacks {
  onReconnecting: (attempt: number, delayMs: number) => void;
  onReconnected: () => void;
  onFailed: () => void;
}

export class ReconnectionManager {
  private attempts: number = 0;
  private config: ReconnectionConfig;
  private callbacks: ReconnectionCallbacks;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<ReconnectionConfig>, callbacks: ReconnectionCallbacks) {
    this.config = {
      maxAttempts: config.maxAttempts || 10,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      jitterFactor: config.jitterFactor || 0.25,
    };
    this.callbacks = callbacks;
  }

  async reconnect(reconnectFn: () => Promise<void>): Promise<void> {
    if (this.attempts >= this.config.maxAttempts) {
      this.callbacks.onFailed();
      return;
    }

    this.attempts++;

    // Calculate exponential backoff delay
    const exponentialDelay = this.config.baseDelay * Math.pow(2, this.attempts - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter (±25% by default)
    const jitter = cappedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, cappedDelay + jitter);

    this.callbacks.onReconnecting(this.attempts, finalDelay);

    return new Promise((resolve) => {
      this.reconnectTimeout = setTimeout(async () => {
        try {
          await reconnectFn();
          this.onSuccess();
          resolve();
        } catch (error) {
          console.error('[RECONNECT] Attempt failed:', error);
          // Retry
          await this.reconnect(reconnectFn);
          resolve();
        }
      }, finalDelay);
    });
  }

  onSuccess(): void {
    this.attempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.callbacks.onReconnected();
  }

  reset(): void {
    this.attempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  getAttempts(): number {
    return this.attempts;
  }
}
