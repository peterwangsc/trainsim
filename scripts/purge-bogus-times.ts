/**
 * Admin script: audits the track_times leaderboard and deletes any entries
 * whose completion time is physically impossible given the game's physics.
 *
 * Run with:
 *   node --experimental-strip-types scripts/purge-bogus-times.ts
 *
 * Requires .env.development with VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { calculateTheoreticalMinimumTimeMs } from "../src/util/minTime.ts";

dotenv.config({ path: ".env.development" });

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_PUBLIC_SUPABASE_URL or VITE_PUBLIC_SUPABASE_ANON_KEY in .env.development");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data: trackTimes, error } = await supabase
  .from("track_times")
  .select("id, level, time_ms, user_progress ( username )");

if (error) {
  console.error("Failed to fetch track times:", error);
  process.exit(1);
}

const minTimesByLevel = new Map<number, number>();
const bogusRecords: { id: string; level: number; username: string | undefined; time_ms: number; theoreticalMin: number }[] = [];

for (const record of trackTimes!) {
  if (!minTimesByLevel.has(record.level)) {
    minTimesByLevel.set(record.level, calculateTheoreticalMinimumTimeMs(record.level));
  }
  const theoreticalMin = minTimesByLevel.get(record.level)!;
  if (record.time_ms < theoreticalMin) {
    bogusRecords.push({
      id: record.id,
      level: record.level,
      username: (record.user_progress as unknown as { username: string } | null)?.username,
      time_ms: record.time_ms,
      theoreticalMin,
    });
  }
}

if (bogusRecords.length === 0) {
  console.log("No bogus records found. Leaderboard is clean.");
  process.exit(0);
}

console.log(`Found ${bogusRecords.length} physically impossible record(s):`);
console.table(bogusRecords);

const { error: deleteError } = await supabase
  .from("track_times")
  .delete()
  .in("id", bogusRecords.map((r) => r.id));

if (deleteError) {
  console.error("Failed to delete bogus records:", deleteError);
  process.exit(1);
}

console.log(`Successfully purged ${bogusRecords.length} bogus record(s).`);
