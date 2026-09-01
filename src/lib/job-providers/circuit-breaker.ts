import { CircuitState, ProviderHealth } from "./types";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Consecutive failures before tripping OPEN
  recoveryThreshold?: number; // Consecutive successes in HALF_OPEN before returning CLOSED
  cooldownMs?: number; // Default cooldown duration when tripped
  rateLimitCooldownMs?: number; // Default cooldown when 429 rate limited
}

interface ProviderInternalState {
  providerId: string;
  providerName: string;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  totalTimeouts: number;
  total429s: number;
  totalLatencyMs: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  lastErrorMessage?: string;
  cooldownUntil?: Date;
}

export class CircuitBreaker {
  private readonly states = new Map<string, ProviderInternalState>();
  private readonly failureThreshold: number;
  private readonly recoveryThreshold: number;
  private readonly defaultCooldownMs: number;
  private readonly rateLimitCooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryThreshold = options.recoveryThreshold ?? 1;
    this.defaultCooldownMs = options.cooldownMs ?? 30000; // 30 seconds
    this.rateLimitCooldownMs = options.rateLimitCooldownMs ?? 60000; // 60 seconds
  }

  /**
   * Register a provider or ensure its tracking state exists
   */
  registerProvider(providerId: string, providerName: string): void {
    if (!this.states.has(providerId)) {
      this.states.set(providerId, {
        providerId,
        providerName,
        state: "CLOSED",
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        totalRequests: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        totalTimeouts: 0,
        total429s: 0,
        totalLatencyMs: 0,
      });
    }
  }

  /**
   * Check if requests are allowed to this provider
   */
  canExecute(providerId: string, providerName = providerId): boolean {
    this.registerProvider(providerId, providerName);
    const state = this.states.get(providerId)!;

    const now = new Date();

    if (state.state === "OPEN") {
      if (state.cooldownUntil && now >= state.cooldownUntil) {
        // Cooldown period elapsed; transition to HALF_OPEN
        state.state = "HALF_OPEN";
        console.log(`[circuit-breaker] Provider '${providerId}' entered HALF_OPEN state for trial request`);
        return true;
      }
      // Circuit remains open
      return false;
    }

    return true; // CLOSED or HALF_OPEN can execute
  }

  /**
   * Record a successful request
   */
  recordSuccess(providerId: string, latencyMs: number, providerName = providerId): void {
    this.registerProvider(providerId, providerName);
    const state = this.states.get(providerId)!;

    state.totalRequests++;
    state.totalSuccesses++;
    state.totalLatencyMs += latencyMs;
    state.lastSuccessAt = new Date();
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses++;

    if (state.state === "HALF_OPEN" && state.consecutiveSuccesses >= this.recoveryThreshold) {
      state.state = "CLOSED";
      state.cooldownUntil = undefined;
      console.log(`[circuit-breaker] Provider '${providerId}' recovered and is now CLOSED (healthy)`);
    }
  }

  /**
   * Record a failure
   */
  recordFailure(
    providerId: string,
    error: {
      isTimeout?: boolean;
      is429?: boolean;
      retryAfterMs?: number;
      message?: string;
      latencyMs?: number;
    } = {},
    providerName = providerId
  ): void {
    this.registerProvider(providerId, providerName);
    const state = this.states.get(providerId)!;

    state.totalRequests++;
    state.totalFailures++;
    if (error.latencyMs) state.totalLatencyMs += error.latencyMs;
    state.lastFailureAt = new Date();
    state.lastErrorMessage = error.message;
    state.consecutiveSuccesses = 0;
    state.consecutiveFailures++;

    if (error.isTimeout) state.totalTimeouts++;
    if (error.is429) state.total429s++;

    const now = Date.now();

    // 1. Rate Limit 429: trip immediately with appropriate cooldown
    if (error.is429) {
      const cooldown = error.retryAfterMs || this.rateLimitCooldownMs;
      state.state = "OPEN";
      state.cooldownUntil = new Date(now + cooldown);
      console.warn(
        `[circuit-breaker] Provider '${providerId}' rate limited (429). Circuit OPEN for ${Math.round(
          cooldown / 1000
        )}s`
      );
      return;
    }

    // 2. Failed in HALF_OPEN: trip back to OPEN immediately
    if (state.state === "HALF_OPEN") {
      state.state = "OPEN";
      state.cooldownUntil = new Date(now + this.defaultCooldownMs);
      console.warn(`[circuit-breaker] Provider '${providerId}' failed in HALF_OPEN trial. Circuit OPEN for ${this.defaultCooldownMs / 1000}s`);
      return;
    }

    // 3. Consecutive failures exceeding threshold: trip to OPEN
    if (state.consecutiveFailures >= this.failureThreshold) {
      state.state = "OPEN";
      state.cooldownUntil = new Date(now + this.defaultCooldownMs);
      console.warn(
        `[circuit-breaker] Provider '${providerId}' exceeded ${this.failureThreshold} failures. Circuit OPEN for ${
          this.defaultCooldownMs / 1000
        }s`
      );
    }
  }

  /**
   * Get health metrics for a provider
   */
  getHealth(providerId: string, providerName = providerId): ProviderHealth {
    this.registerProvider(providerId, providerName);
    const state = this.states.get(providerId)!;

    const avgLatency =
      state.totalRequests > 0 ? Math.round(state.totalLatencyMs / state.totalRequests) : 0;

    let status: "healthy" | "degraded" | "down" = "healthy";
    if (state.state === "OPEN") {
      status = "down";
    } else if (state.state === "HALF_OPEN" || state.consecutiveFailures > 0) {
      status = "degraded";
    }

    return {
      providerId: state.providerId,
      providerName: state.providerName,
      status,
      circuitState: state.state,
      consecutiveFailures: state.consecutiveFailures,
      consecutiveSuccesses: state.consecutiveSuccesses,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt,
      lastErrorMessage: state.lastErrorMessage,
      averageLatencyMs: avgLatency,
      totalRequests: state.totalRequests,
      cooldownUntil: state.cooldownUntil,
    };
  }

  /**
   * Reset all or single provider metrics (useful for testing)
   */
  reset(providerId?: string): void {
    if (providerId) {
      this.states.delete(providerId);
    } else {
      this.states.clear();
    }
  }
}

// Global Singleton Circuit Breaker
export const globalCircuitBreaker = new CircuitBreaker();
