import { describe, it, expect } from "vitest";
import { calculateBackoff } from "../src/lib/ingestion/http-client";

describe("Retry & Backoff", () => {
  it("should calculate increasing backoff delays with jitter", () => {
    const delay0 = calculateBackoff(0, 500, 8000);
    const delay1 = calculateBackoff(1, 500, 8000);
    const delay2 = calculateBackoff(2, 500, 8000);

    expect(delay0).toBeGreaterThanOrEqual(100);
    expect(delay1).toBeGreaterThanOrEqual(delay0 * 0.8);
    expect(delay2).toBeGreaterThanOrEqual(delay1 * 0.8);
  });

  it("should respect maxDelay cap", () => {
    const delay = calculateBackoff(10, 500, 4000);
    expect(delay).toBeLessThanOrEqual(6000); // 4000 + max jitter
  });
});
