import { globalCircuitBreaker } from "./circuit-breaker";

export interface RapidApiRequestOptions {
  providerId: string;
  providerName: string;
  host: string;
  url: string;
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
}

export class RapidApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly isRateLimit: boolean;
  readonly isTimeout: boolean;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      isRateLimit?: boolean;
      isTimeout?: boolean;
      retryAfterMs?: number;
    } = {}
  ) {
    super(message);
    this.name = "RapidApiError";
    this.code = options.code || "RAPIDAPI_ERROR";
    this.status = options.status;
    this.isRateLimit = Boolean(options.isRateLimit || options.status === 429);
    this.isTimeout = Boolean(options.isTimeout);
    this.retryAfterMs = options.retryAfterMs;
  }
}

/**
 * Safely retrieve the RapidAPI key for a specific provider or the global default
 */
export function getRapidApiKey(providerId?: string): string {
  if (providerId) {
    const overrideVar = `RAPIDAPI_${providerId.toUpperCase().replace(/-/g, "_")}_KEY`;
    const specificKey = process.env[overrideVar]?.trim();
    if (specificKey) return specificKey;
  }

  const globalKey = process.env.RAPIDAPI_KEY?.trim();
  if (globalKey) return globalKey;

  throw new RapidApiError(
    `RapidAPI credentials not configured for provider '${providerId || "default"}'. Set RAPIDAPI_KEY in environment.`,
    { code: "CREDENTIALS_MISSING", status: 500 }
  );
}

/**
 * Resiliently execute a RapidAPI request with timeout, circuit breaking, rate limit detection, and retries
 */
export async function executeRapidApiRequest<T = unknown>(
  options: RapidApiRequestOptions
): Promise<{ data: T; latencyMs: number; status: number }> {

  const {
    providerId,
    providerName,
    host,
    url,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 12000,
    maxRetries = 2,
  } = options;

  // 1. Circuit Breaker Check
  if (!globalCircuitBreaker.canExecute(providerId, providerName)) {
    throw new RapidApiError(
      `Provider '${providerName}' circuit breaker is OPEN due to repeated failures. Requests temporarily halted.`,
      { code: "CIRCUIT_OPEN", status: 503 }
    );
  }

  // 2. Resolve API Key
  const apiKey = getRapidApiKey(providerId);

  const requestHeaders: Record<string, string> = {
    "x-rapidapi-host": host,
    "x-rapidapi-key": apiKey,
    "Accept": "application/json",
    ...headers,
  };

  let formattedBody: string | undefined = undefined;
  if (body) {
    if (typeof body === "string") {
      formattedBody = body;
    } else {
      formattedBody = JSON.stringify(body);
      if (!requestHeaders["Content-Type"]) {
        requestHeaders["Content-Type"] = "application/json";
      }
    }
  }

  let attempt = 0;
  const startTime = Date.now();

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: formattedBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);
      const latencyMs = Date.now() - startTime;

      // 401 / 403 Authentication failure (DO NOT RETRY)
      if (response.status === 401 || response.status === 403) {
        const err = new RapidApiError(
          `RapidAPI authentication failed for ${providerName} (HTTP ${response.status}). Check RAPIDAPI_KEY.`,
          { code: "AUTHENTICATION_ERROR", status: response.status }
        );
        globalCircuitBreaker.recordFailure(providerId, { message: err.message, latencyMs }, providerName);
        throw err;
      }

      // 429 Rate Limit
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 30000;

        globalCircuitBreaker.recordFailure(
          providerId,
          { is429: true, retryAfterMs, message: "Rate limit exceeded (HTTP 429)", latencyMs },
          providerName
        );

        if (attempt < maxRetries) {
          const delay = Math.min(8000, 1000 * Math.pow(2, attempt));
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
          continue;
        }

        throw new RapidApiError(`Rate limit exceeded for provider '${providerName}' (HTTP 429).`, {
          code: "RATE_LIMITED",
          status: 429,
          isRateLimit: true,
          retryAfterMs,
        });
      }

      // 5xx Server Errors
      if (response.status >= 500 && response.status <= 504) {
        if (attempt < maxRetries) {
          const delay = 500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
          continue;
        }

        const errMsg = `Provider '${providerName}' returned HTTP ${response.status}: ${response.statusText}`;
        globalCircuitBreaker.recordFailure(providerId, { message: errMsg, latencyMs }, providerName);
        throw new RapidApiError(errMsg, { code: "SERVER_ERROR", status: response.status });
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        const errMsg = `Provider '${providerName}' request failed (HTTP ${response.status}): ${errText.slice(0, 200)}`;
        globalCircuitBreaker.recordFailure(providerId, { message: errMsg, latencyMs }, providerName);
        throw new RapidApiError(errMsg, { code: "HTTP_ERROR", status: response.status });
      }

      const text = await response.text();
      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        const errMsg = `Malformed JSON response received from provider '${providerName}'`;
        globalCircuitBreaker.recordFailure(providerId, { message: errMsg, latencyMs }, providerName);
        throw new RapidApiError(errMsg, { code: "MALFORMED_RESPONSE", status: 502 });
      }

      // Success
      globalCircuitBreaker.recordSuccess(providerId, latencyMs, providerName);
      return { data, latencyMs, status: response.status };
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      const latencyMs = Date.now() - startTime;

      if (err instanceof RapidApiError) {
        throw err;
      }

      const errorObj = err as Error;
      const isTimeout = errorObj.name === "AbortError" || errorObj.message?.includes("aborted");

      if (isTimeout) {
        globalCircuitBreaker.recordFailure(
          providerId,
          { isTimeout: true, message: `Request timed out after ${timeoutMs}ms`, latencyMs },
          providerName
        );
        throw new RapidApiError(`Request to '${providerName}' timed out after ${timeoutMs}ms`, {
          code: "TIMEOUT",
          status: 504,
          isTimeout: true,
        });
      }

      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      const errMsg = `Network failure communicating with '${providerName}': ${errorObj.message}`;
      globalCircuitBreaker.recordFailure(providerId, { message: errMsg, latencyMs }, providerName);
      throw new RapidApiError(errMsg, { code: "NETWORK_ERROR", status: 503 });
    }
  }

  throw new RapidApiError(`Failed to execute request to '${providerName}' after retries`, {
    code: "REQUEST_FAILED",
    status: 500,
  });
}
