import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/util/Supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../src/util/Supabase";
import {
  login,
  logout,
  saveProgress,
  saveSoundSettings,
  fetchUserPresetContents,
} from "../src/util/Username";
import { GameState } from "../src/game/GameState";

// ---------------------------------------------------------------------------
// localStorage stub
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
});

function makeChain(result: { data?: any; error?: any } = {}) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: any = {};
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
  // Clear localStorage between tests
  Object.keys(store).forEach((k) => delete store[k]);
});

// ---------------------------------------------------------------------------
// fetchUserPresetContents
// ---------------------------------------------------------------------------
describe("fetchUserPresetContents", () => {
  it("returns level and volume settings for a known user", async () => {
    const chain = makeChain({
      data: {
        level: 4,
        username: "alice",
        master_volume: 0.8,
        music_volume: 0.5,
        sfx_volume: 0.3,
      },
    });
    mockFrom.mockReturnValue(chain);

    const result = await fetchUserPresetContents("user-1", "alice");

    expect(result.level).toBe(4);
    expect(result.masterVolume).toBe(0.8);
    expect(result.musicVolume).toBe(0.5);
    expect(result.sfxVolume).toBe(0.3);
  });

  it("returns defaults when user is not found", async () => {
    const chain = makeChain({ data: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchUserPresetContents("unknown-id", null);

    expect(result).toEqual({ level: 1, masterVolume: null, musicVolume: null, sfxVolume: null });
  });

  it("returns defaults when stored username does not match", async () => {
    // DB row has a different username than what was passed — indicates stale local storage
    const chain = makeChain({
      data: { level: 3, username: "bob", master_volume: 0.5, music_volume: 0.5, sfx_volume: 0.5 },
    });
    mockFrom.mockReturnValue(chain);

    const result = await fetchUserPresetContents("user-1", "alice"); // alice ≠ bob

    expect(result).toEqual({ level: 1, masterVolume: null, musicVolume: null, sfxVolume: null });
  });

  it("returns defaults on DB error", async () => {
    const chain = makeChain({ error: { message: "db error" } });
    mockFrom.mockReturnValue(chain);

    const result = await fetchUserPresetContents("user-1", null);

    expect(result).toEqual({ level: 1, masterVolume: null, musicVolume: null, sfxVolume: null });
  });
});

// ---------------------------------------------------------------------------
// saveProgress
// ---------------------------------------------------------------------------
describe("saveProgress", () => {
  it("upserts with username when provided", async () => {
    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    await saveProgress("user-1", "alice", 5);

    expect(mockFrom).toHaveBeenCalledWith("user_progress");
    expect(chain.upsert).toHaveBeenCalledWith({ id: "user-1", level: 5, username: "alice" });
  });

  it("upserts without username when null", async () => {
    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    await saveProgress("user-1", null, 3);

    expect(chain.upsert).toHaveBeenCalledWith({ id: "user-1", level: 3 });
  });
});

// ---------------------------------------------------------------------------
// saveSoundSettings
// ---------------------------------------------------------------------------
describe("saveSoundSettings", () => {
  it("upserts all three volume values", async () => {
    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    await saveSoundSettings("user-1", 0.9, 0.6, 0.4);

    expect(chain.upsert).toHaveBeenCalledWith({
      id: "user-1",
      master_volume: 0.9,
      music_volume: 0.6,
      sfx_volume: 0.4,
    });
  });
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe("login", () => {
  it("creates a new account when username does not exist in DB", async () => {
    store["trainsim_uuid"] = "anon-user-id";
    const chain = makeChain({ data: null }); // no existing account
    mockFrom.mockReturnValue(chain);

    const gameState = new GameState(null, "anon-user-id");
    gameState.level = 2;

    const result = await login("NewPlayer", gameState);

    expect(result).not.toBeNull();
    expect(result!.username).toBe("newplayer"); // normalised to lowercase
    expect(gameState.username).toBe("newplayer");
    // Upsert called to create the record
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ username: "newplayer", level: 2 }),
    );
  });

  it("signs into an existing account and updates gameState", async () => {
    store["trainsim_uuid"] = "current-id";
    store["trainsim_username"] = "alice";

    const chain = makeChain({
      data: {
        id: "alice-id",
        level: 7,
        username: "alice",
        master_volume: 0.8,
        music_volume: 0.5,
        sfx_volume: 0.3,
      },
    });
    mockFrom.mockReturnValue(chain);

    const gameState = new GameState("alice", "current-id");
    gameState.level = 3;

    const result = await login("alice", gameState);

    expect(result).not.toBeNull();
    expect(result!.userId).toBe("alice-id");
    expect(result!.level).toBe(7);
    expect(gameState.masterVolume).toBe(0.8);
    expect(gameState.musicVolume).toBe(0.5);
    expect(gameState.sfxVolume).toBe(0.3);
  });

  it("merges anonymous progress when logging in for the first time", async () => {
    // Anonymous user (no username stored) has reached level 5
    store["trainsim_uuid"] = "anon-id";

    const existingUser = {
      id: "alice-id",
      level: 3, // alice's DB level is lower than anon's level
      username: "alice",
      master_volume: 0.5,
      music_volume: 0.5,
      sfx_volume: 0.5,
    };
    // First from() call: select existing account. Subsequent from() calls: upsert.
    const selectChain = makeChain({ data: existingUser });
    const upsertChain = makeChain();
    mockFrom
      .mockReturnValueOnce(selectChain) // select existing user
      .mockReturnValue(upsertChain);    // saveProgress + saveUserId upserts

    const gameState = new GameState(null, "anon-id");
    gameState.level = 5; // anonymous user was ahead

    const result = await login("alice", gameState);

    expect(result).not.toBeNull();
    // The anonymous user's higher level should be saved
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ level: 5, username: "alice" }),
    );
    // The anon id should be saved for logout restoration
    expect(store["trainsim_userless_uuid"]).toBe("anon-id");
  });

  it("returns null on DB error", async () => {
    const chain = makeChain({ error: { message: "connection failed" } });
    mockFrom.mockReturnValue(chain);

    const gameState = new GameState(null, "user-1");
    const result = await login("alice", gameState);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
describe("logout", () => {
  it("restores the previous anonymous session when one was saved", async () => {
    store["trainsim_uuid"] = "alice-id";
    store["trainsim_username"] = "alice";
    store["trainsim_userless_uuid"] = "anon-id";

    const chain = makeChain({ data: { level: 2 } }); // anon had level 2
    mockFrom.mockReturnValue(chain);

    const result = await logout();

    expect(result.userId).toBe("anon-id");
    expect(result.level).toBe(2);
    expect(store["trainsim_uuid"]).toBe("anon-id");
    expect(store["trainsim_username"]).toBeUndefined();
    expect(store["trainsim_userless_uuid"]).toBeUndefined();
  });

  it("creates a brand-new anonymous session when no previous session exists", async () => {
    store["trainsim_uuid"] = "alice-id";
    store["trainsim_username"] = "alice";
    // no trainsim_userless_uuid

    const chain = makeChain();
    mockFrom.mockReturnValue(chain);

    const result = await logout();

    expect(result.level).toBe(1);
    expect(result.userId).not.toBe("alice-id"); // new UUID
    expect(store["trainsim_username"]).toBeUndefined();
    // A new user_progress row should be created
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ level: 1 }),
    );
  });
});
