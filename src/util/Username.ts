import { GameState } from "../game/GameState";
import { supabase } from "./Supabase";

export type LoginResult = {
  userId: string;
  username: string;
  level: number;
};

export type LogoutResult = {
  userId: string;
  level: number;
};

const USER_ID_STORAGE_KEY = "trainsim_uuid";
const USERNAME_STORAGE_KEY = "trainsim_username";
const USERLESS_USER_ID_STORAGE_KEY = "trainsim_userless_uuid";

function saveUserlessUserId(userId: string): void {
  localStorage.setItem(USERLESS_USER_ID_STORAGE_KEY, userId);
}

function getUserlessUserId(): string | null {
  return localStorage.getItem(USERLESS_USER_ID_STORAGE_KEY);
}

function removeUserlessUserId(): void {
  localStorage.removeItem(USERLESS_USER_ID_STORAGE_KEY);
}

function saveUsername(username: string): void {
  const normalizedUsername = username.trim().toLowerCase();
  localStorage.setItem(USERNAME_STORAGE_KEY, normalizedUsername);
}

function getUsername(): string | null {
  const username = localStorage.getItem(USERNAME_STORAGE_KEY);
  return username ? username.trim().toLowerCase() : null;
}

function removeUsername(): void {
  localStorage.removeItem(USERNAME_STORAGE_KEY);
}

function saveUserId(userId: string): void {
  localStorage.setItem(USER_ID_STORAGE_KEY, userId);
}

function getUserId(): string | null {
  return localStorage.getItem(USER_ID_STORAGE_KEY);
}

export function getOrCreateUserId(): string {
  const existing = getUserId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  saveUserId(id);
  return id;
}

export function getUsernameFromLocalStorage(): string | null {
  try {
    return getUsername();
  } catch (err) {
    console.error("Failed to get username from localStorage", err);
    return null;
  }
}

export async function fetchUserPresetContents(
  userId: string,
  username: string | null,
): Promise<{
  level: number;
  masterVolume: number | null;
  musicVolume: number | null;
  sfxVolume: number | null;
}> {
  let result = {
    level: 1,
    masterVolume: null as number | null,
    musicVolume: null as number | null,
    sfxVolume: null as number | null,
  };
  try {
    const { data, error } = await supabase
      .from("user_progress")
      .select("level, username, master_volume, music_volume, sfx_volume")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user progress", error);
      return result;
    }

    if (data && data.username && data.username !== username) {
      return result;
    }

    if (data) {
      if (data.level && data.level > result.level) {
        result.level = data.level as number;
      }
      if (data.master_volume !== null && data.master_volume !== undefined) {
        result.masterVolume = data.master_volume as number;
      }
      if (data.music_volume !== null && data.music_volume !== undefined) {
        result.musicVolume = data.music_volume as number;
      }
      if (data.sfx_volume !== null && data.sfx_volume !== undefined) {
        result.sfxVolume = data.sfx_volume as number;
      }
    }
  } catch (err) {
    console.error("Failed to fetch user progress", err);
  }
  return result;
}

export async function saveSoundSettings(
  userId: string,
  masterVolume: number,
  musicVolume: number,
  sfxVolume: number,
): Promise<void> {
  try {
    await supabase.from("user_progress").upsert({
      id: userId,
      master_volume: masterVolume,
      music_volume: musicVolume,
      sfx_volume: sfxVolume,
    });
  } catch (err) {
    console.error("Failed to save sound settings", err);
  }
}

export async function login(
  enteredUsername: string,
  gameState: GameState,
): Promise<LoginResult | null> {
  try {
    const normalizedUsername = enteredUsername.trim().toLowerCase();
    const { data, error } = await supabase
      .from("user_progress")
      .select("id, level, username, master_volume, music_volume, sfx_volume")
      .eq("username", normalizedUsername)
      .maybeSingle();

    const currentUsername = gameState.username;
    const currentUserId = gameState.userId;
    const targetLevel = gameState.level;

    if (error) {
      console.error("Failed to login", error);
      return null;
    }

    if (data) {
      if (!currentUsername && currentUserId !== data.id) {
        // previously playing on an anonymous id,
        // save the old user id to return to when logging out
        saveUserlessUserId(currentUserId);
        const newLevel = Math.max(targetLevel, data.level as number);
        if (newLevel > (data.level as number)) {
          // if the anonymous user has made progress,
          // save the progress to the existing account
          await saveProgress(
            data.id as string,
            data.username as string,
            newLevel,
          );
        }
        saveUserId(data.id as string);
        saveUsername(data.username as string);
        gameState.update({
          userId: data.id as string,
          username: data.username as string,
          level: newLevel,
          masterVolume: data.master_volume as number,
          musicVolume: data.music_volume as number,
          sfxVolume: data.sfx_volume as number,
        });
      }

      // user is logging into an existing account
      // from another existing account
      saveUserId(data.id as string);
      saveUsername(data.username as string);
      gameState.update({
        userId: data.id as string,
        username: data.username as string,
        level: data.level as number,
        masterVolume: data.master_volume as number,
        musicVolume: data.music_volume as number,
        sfxVolume: data.sfx_volume as number,
      });
    } else {
      // new user creation
      const payload: Record<string, unknown> = {
        id: currentUserId,
        level: targetLevel,
        username: normalizedUsername,
      };
      await supabase.from("user_progress").upsert(payload);

      saveUsername(normalizedUsername);
      gameState.update({
        username: normalizedUsername,
      });
    }

    return {
      userId: gameState.userId,
      username: gameState.username!,
      level: gameState.level,
    };
  } catch (err) {
    console.error("Failed to login", err);
    return null;
  }
}

export async function logout(): Promise<LogoutResult> {
  const oldUuid = getUserlessUserId();
  let newUserId: string;
  let level = 1;

  if (oldUuid) {
    saveUserId(oldUuid);
    removeUserlessUserId();
    newUserId = oldUuid;
    try {
      const { data } = await supabase
        .from("user_progress")
        .select("level")
        .eq("id", oldUuid)
        .maybeSingle();
      if (data) {
        level = data.level as number;
      } else {
        await supabase.from("user_progress").upsert({ id: oldUuid, level: 1 });
      }
    } catch (err) {
      console.error("Failed to update userless progress", err);
    }
  } else {
    newUserId = crypto.randomUUID();
    saveUserId(newUserId);
    try {
      await supabase.from("user_progress").upsert({ id: newUserId, level: 1 });
    } catch (err) {
      console.error("Failed to init new userless progress", err);
    }
  }

  removeUsername();
  return { userId: newUserId!, level };
}

export async function saveProgress(
  userId: string,
  username: string | null,
  level: number,
): Promise<void> {
  try {
    const payload: Record<string, unknown> = { id: userId, level };
    if (username) payload.username = username;
    await supabase.from("user_progress").upsert(payload);
  } catch (err) {
    console.error("Failed to save progress", err);
  }
}
