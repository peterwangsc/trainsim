import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
export let supabase: SupabaseClient;

export function initSupabase(): SupabaseClient {
  if (supabase) return supabase;
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

export type TrackTimeRecord = {
  username: string;
  timeMs: number;
};

export async function submitTrackTime(
  userProgressId: string,
  level: number,
  timeMs: number
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
  level: number
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
  level: number
): Promise<TrackTimeRecord | null> {
  try {
    const { data, error } = await supabase
      .from("track_times")
      .select(`
        time_ms,
        user_progress (
          username
        )
      `)
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
