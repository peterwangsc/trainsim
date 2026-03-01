import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client before importing anything that uses it
vi.mock("../src/util/Supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../src/util/Supabase";
import {
  submitTrackTime,
  getPersonalBestForLevel,
  getFastestTimeForLevel,
  getMaxLevelWithTimes,
  getTopTimesForLevels,
} from "../src/util/TrackTimes";

// Builds a fluent Supabase query chain whose terminal methods resolve to `result`.
function makeChain(result: { data?: any; error?: any } = {}) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: any = {};
  // Make chain thenable so `await chain` works (Supabase builder pattern for multi-row queries)
  chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) =>
    Promise.resolve(resolved).then(resolve, reject);
  for (const m of ["select", "eq", "order", "limit", "gte", "lte", "delete"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  chain.upsert = vi.fn().mockResolvedValue(resolved);
  chain.insert = vi.fn().mockResolvedValue(resolved);
  chain.in = vi.fn().mockResolvedValue(resolved);
  return chain;
}

const mockFrom = vi.mocked(supabase.from);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// submitTrackTime
// ---------------------------------------------------------------------------
describe("submitTrackTime", () => {
  it("inserts a row with correct payload", async () => {
    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    await submitTrackTime("user-1", 3, 75000);

    expect(mockFrom).toHaveBeenCalledWith("track_times");
    expect(chain.insert).toHaveBeenCalledWith({
      user_progress_id: "user-1",
      level: 3,
      time_ms: 75000,
    });
  });

  it("swallows errors silently", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("network failure");
    });
    await expect(submitTrackTime("user-1", 1, 60000)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPersonalBestForLevel
// ---------------------------------------------------------------------------
describe("getPersonalBestForLevel", () => {
  it("returns the fastest time in ms when a record exists", async () => {
    const chain = makeChain({ data: { time_ms: 42500 } });
    mockFrom.mockReturnValue(chain);

    const result = await getPersonalBestForLevel("user-1", 2);

    expect(result).toBe(42500);
    expect(chain.eq).toHaveBeenCalledWith("user_progress_id", "user-1");
    expect(chain.eq).toHaveBeenCalledWith("level", 2);
  });

  it("returns null when no record exists", async () => {
    const chain = makeChain({ data: null });
    mockFrom.mockReturnValue(chain);

    expect(await getPersonalBestForLevel("user-1", 2)).toBeNull();
  });

  it("returns null on DB error", async () => {
    const chain = makeChain({ error: { message: "db error" } });
    mockFrom.mockReturnValue(chain);

    expect(await getPersonalBestForLevel("user-1", 2)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getFastestTimeForLevel
// ---------------------------------------------------------------------------
describe("getFastestTimeForLevel", () => {
  it("returns a TrackTimeRecord with username from joined user_progress", async () => {
    const chain = makeChain({
      data: { time_ms: 60000, user_progress: { username: "alice" } },
    });
    mockFrom.mockReturnValue(chain);

    const result = await getFastestTimeForLevel(1);

    expect(result).toEqual({ username: "alice", timeMs: 60000 });
  });

  it("handles user_progress returned as an array (Supabase join variant)", async () => {
    const chain = makeChain({
      data: { time_ms: 55000, user_progress: [{ username: "bob" }] },
    });
    mockFrom.mockReturnValue(chain);

    expect(await getFastestTimeForLevel(1)).toEqual({ username: "bob", timeMs: 55000 });
  });

  it("falls back to Anonymous when username is missing", async () => {
    const chain = makeChain({
      data: { time_ms: 70000, user_progress: null },
    });
    mockFrom.mockReturnValue(chain);

    expect(await getFastestTimeForLevel(1)).toEqual({ username: "Anonymous", timeMs: 70000 });
  });

  it("returns null when no record exists", async () => {
    const chain = makeChain({ data: null });
    mockFrom.mockReturnValue(chain);

    expect(await getFastestTimeForLevel(1)).toBeNull();
  });

  it("returns null on DB error", async () => {
    const chain = makeChain({ error: { message: "db error" } });
    mockFrom.mockReturnValue(chain);

    expect(await getFastestTimeForLevel(1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getMaxLevelWithTimes
// ---------------------------------------------------------------------------
describe("getMaxLevelWithTimes", () => {
  it("returns the highest level that has a time", async () => {
    const chain = makeChain({ data: { level: 5 } });
    mockFrom.mockReturnValue(chain);

    expect(await getMaxLevelWithTimes()).toBe(5);
  });

  it("returns 1 when the table is empty", async () => {
    const chain = makeChain({ data: null });
    mockFrom.mockReturnValue(chain);

    expect(await getMaxLevelWithTimes()).toBe(1);
  });

  it("returns 1 on DB error", async () => {
    const chain = makeChain({ error: { message: "db error" } });
    mockFrom.mockReturnValue(chain);

    expect(await getMaxLevelWithTimes()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getTopTimesForLevels
// ---------------------------------------------------------------------------
describe("getTopTimesForLevels", () => {
  it("groups records by level and keeps top 3 unique users per level", async () => {
    const chain = makeChain({
      data: [
        { level: 2, time_ms: 50000, user_progress: { username: "alice" } },
        { level: 2, time_ms: 55000, user_progress: { username: "bob" } },
        { level: 2, time_ms: 60000, user_progress: { username: "alice" } }, // duplicate alice, should be skipped
        { level: 1, time_ms: 45000, user_progress: { username: "carol" } },
      ],
    });
    mockFrom.mockReturnValue(chain);

    const result = await getTopTimesForLevels(2, 1);

    // Level 2 first (descending order), then level 1
    expect(result).toHaveLength(2);
    expect(result[0].level).toBe(2);
    expect(result[0].records).toHaveLength(2); // alice + bob, second alice skipped
    expect(result[0].records[0]).toEqual({ username: "alice", timeMs: 50000 });
    expect(result[0].records[1]).toEqual({ username: "bob", timeMs: 55000 });
    expect(result[1].level).toBe(1);
    expect(result[1].records[0]).toEqual({ username: "carol", timeMs: 45000 });
  });

  it("returns empty array when no data exists", async () => {
    const chain = makeChain({ data: null });
    mockFrom.mockReturnValue(chain);

    expect(await getTopTimesForLevels(5, 1)).toEqual([]);
  });

  it("returns empty array on DB error", async () => {
    const chain = makeChain({ error: { message: "db error" } });
    mockFrom.mockReturnValue(chain);

    expect(await getTopTimesForLevels(5, 1)).toEqual([]);
  });
});
