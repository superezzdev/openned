export interface HttpClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  headers?: Record<string, string>;
  minIntervalMs?: number; // per-host throttling
}

const DEFAULT_OPTIONS: Required<HttpClientOptions> = {
  timeoutMs: 20000,
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 8000,
  headers: {
    "User-Agent": "Openned-JobIngestion/1.0 (+https://openned.dev; contact: bot@openned.dev)",
    "Accept": "application/json, text/plain, */*",
  },
  minIntervalMs: 200,
};

// Map of hostnames to timestamp of last request to throttle per-host
const hostLastRequestMap = new Map<string, number>();

async function throttleHost(url: string, minIntervalMs: number): Promise<void> {
  try {
    const host = new URL(url).hostname;
    const now = Date.now();
    const last = hostLastRequestMap.get(host) || 0;
    const elapsed = now - last;
    if (elapsed < minIntervalMs) {
      const wait = minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    hostLastRequestMap.set(host, Date.now());
  } catch {
    // Ignore URL parse errors in host tracker
  }
}

/**
 * Calculates exponential backoff with full jitter
 */
export function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  // Full jitter: random between 0.5 * exponential and 1.5 * exponential
  const jitter = (Math.random() - 0.5) * exponential * 0.5;
  return Math.max(100, Math.floor(exponential + jitter));
}

/**
 * Robust fetch with retries, exponential backoff, jitter, timeouts, and rate limit handling
 */
export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  clientOptions: HttpClientOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...clientOptions };
  let attempt = 0;

  while (attempt <= opts.maxRetries) {
    await throttleHost(url, opts.minIntervalMs);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const mergedHeaders = {
        ...opts.headers,
        ...(options.headers as Record<string, string>),
      };

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: mergedHeaders,
      });

      clearTimeout(timeoutId);

      // Handle 429 Too Many Requests
      if (response.status === 429) {
        if (attempt < opts.maxRetries) {
          const retryAfterHeader = response.headers.get("Retry-After");
          let delayMs = opts.baseDelayMs;
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds)) {
              delayMs = Math.min(opts.maxDelayMs, parsedSeconds * 1000);
            }
          } else {
            delayMs = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
          }

          console.warn(`[HTTP 429] Rate limited on ${url}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }
        return response;
      }

      // Handle 5xx Server Errors (500, 502, 503, 504)
      if (response.status >= 500 && response.status <= 504) {
        if (attempt < opts.maxRetries) {
          const delayMs = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
          console.warn(`[HTTP ${response.status}] Server error on ${url}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }
        return response;
      }

      // Permanent 4xx or success 2xx / 3xx
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isTimeout = err.name === "AbortError";
      const isNetworkError = err.message?.includes("fetch failed") || err.code === "ECONNRESET" || isTimeout;

      if (isNetworkError && attempt < opts.maxRetries) {
        const delayMs = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
        console.warn(`[Network Error] ${isTimeout ? "Request timed out" : err.message} for ${url}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${opts.maxRetries} retries`);
}

/**
 * Fetch JSON with resilient error handling and response validation
 */
export async function fetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  clientOptions: HttpClientOptions = {}
): Promise<T> {
  const res = await resilientFetch(url, options, clientOptions);

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`HTTP Error ${res.status} (${res.statusText}) while fetching ${url}: ${errorText.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

/**
 * Fetch HTML / Text with resilient error handling
 */
export async function fetchText(
  url: string,
  options: RequestInit = {},
  clientOptions: HttpClientOptions = {}
): Promise<string> {
  const mergedHeaders = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...(clientOptions.headers || {}),
  };

  const res = await resilientFetch(url, options, {
    ...clientOptions,
    headers: mergedHeaders,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`HTTP Error ${res.status} (${res.statusText}) while fetching ${url}: ${errorText.slice(0, 300)}`);
  }

  return await res.text();
}
