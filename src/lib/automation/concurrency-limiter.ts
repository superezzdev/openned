/**
 * Concurrency Limiter (Semaphore)
 *
 * Controls maximum concurrent Browserbase sessions to manage costs and rate limits.
 */

export class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(public readonly maxConcurrency: number = 2) {}

  public get currentActive(): number {
    return this.activeCount;
  }

  public get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Acquire a slot. Resolves when concurrency capacity is available.
   */
  public async acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  /**
   * Release a slot and trigger the next waiting task if any.
   */
  public release(): void {
    if (this.activeCount > 0) {
      this.activeCount--;
    }

    if (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * Execute an async function within the concurrency limit.
   */
  public async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

const defaultMax = parseInt(process.env.MAX_BROWSERBASE_CONCURRENCY || "2", 10);
export const browserbaseLimiter = new ConcurrencyLimiter(Number.isNaN(defaultMax) ? 2 : defaultMax);
