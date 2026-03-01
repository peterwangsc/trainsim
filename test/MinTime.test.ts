import { describe, it, expect } from "vitest";
import { calculateTheoreticalMinimumTimeMs } from "@/util/minTime";

describe("calculateTheoreticalMinimumTimeMs", () => {
  it("returns a positive finite number for level 1", () => {
    const ms = calculateTheoreticalMinimumTimeMs(1);
    expect(ms).toBeGreaterThan(0);
    expect(Number.isFinite(ms)).toBe(true);
  });

  it("is deterministic — same level always returns the same value", () => {
    expect(calculateTheoreticalMinimumTimeMs(1)).toBe(calculateTheoreticalMinimumTimeMs(1));
    expect(calculateTheoreticalMinimumTimeMs(2)).toBe(calculateTheoreticalMinimumTimeMs(2));
  });

  it("returns a physically plausible value (between 30s and 10min)", () => {
    const ms = calculateTheoreticalMinimumTimeMs(1);
    expect(ms).toBeGreaterThan(30_000);
    expect(ms).toBeLessThan(600_000);
  });
});
