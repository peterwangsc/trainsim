import { supabase } from "@/util/Supabase";

export type TrackTimeRecord = {
  username: string;
  timeMs: number;
};

export type LevelLeaderboard = {
  level: number;
  records: TrackTimeRecord[];
};

export async function submitTrackTime(
  userProgressId: string,
  level: number,
  timeMs: number,
): Promise<void> {
  try {
    await supabase.from("track_times").insert({
      user_progress_id: userProgressId,
      level,
      time_ms: timeMs,
    });
  } catch (err) {
    console.error("Failed to submit track time", err);
  }
}

export async function getPersonalBestForLevel(
  userProgressId: string,
  level: number,
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("track_times")
      .select("time_ms")
      .eq("user_progress_id", userProgressId)
      .eq("level", level)
      .order("time_ms", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch personal best", error);
      return null;
    }

    return data ? (data.time_ms as number) : null;
  } catch (err) {
    console.error("Failed to fetch personal best", err);
  }
  return null;
}

export async function getFastestTimeForLevel(
  level: number,
): Promise<TrackTimeRecord | null> {
  try {
    const { data, error } = await supabase
      .from("track_times")
      .select(`time_ms, user_progress ( username )`)
      .eq("level", level)
      .order("time_ms", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch fastest track time", error);
      return null;
    }

    if (data) {
      const username = Array.isArray(data.user_progress)
        ? data.user_progress[0]?.username
        : (data.user_progress as any)?.username;
      return {
        username: username || "Anonymous",
        timeMs: data.time_ms as number,
      };
    }
  } catch (err) {
    console.error("Failed to fetch fastest track time", err);
  }
  return null;
}

export async function getMaxLevelWithTimes(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("track_times")
      .select("level")
      .order("level", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch max level", error);
      return 1;
    }

    return data ? data.level : 1;
  } catch (err) {
    console.error("Failed to fetch max level", err);
    return 1;
  }
}

export async function getTopTimesForLevels(
  maxLevel: number,
  minLevel: number,
): Promise<LevelLeaderboard[]> {
  try {
    const { data, error } = await supabase
      .from("track_times")
      .select(`level, time_ms, user_progress ( username )`)
      .gte("level", minLevel)
      .lte("level", maxLevel)
      .order("level", { ascending: false })
      .order("time_ms", { ascending: true });

    if (error) {
      console.error("Failed to fetch top times", error);
      return [];
    }

    if (data) {
      const map = new Map<number, TrackTimeRecord[]>();
      for (const row of data) {
        if (!map.has(row.level)) map.set(row.level, []);
        const records = map.get(row.level)!;
        const username = Array.isArray(row.user_progress)
          ? row.user_progress[0]?.username
          : (row.user_progress as any)?.username;
        const uname = username || "Anonymous";
        if (records.length < 3 && !records.some((r) => r.username === uname)) {
          records.push({ username: uname, timeMs: row.time_ms as number });
        }
      }

      const result: LevelLeaderboard[] = [];
      for (let i = maxLevel; i >= minLevel; i--) {
        if (map.has(i) && map.get(i)!.length > 0) {
          result.push({ level: i, records: map.get(i)! });
        }
      }
      return result;
    }
  } catch (err) {
    console.error("Failed to fetch top times", err);
  }
  return [];
}
