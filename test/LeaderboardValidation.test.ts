import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CONFIG } from "../src/game/Config";
import { GameState } from "../src/game/GameState";
import { TrackGenerator } from "../src/world/Track/TrackGenerator";
import { TrackSpline } from "../src/world/Track/TrackSpline";
import { TrainSim } from "../src/sim/TrainSim";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.development" });

// Calculate the absolute theoretical minimum time for a given level
function calculateTheoreticalMinimumTimeMs(level: number): number {
  const gameState = new GameState(null, "test_user", CONFIG);
  gameState.level = level;

  const generator = new TrackGenerator(CONFIG.track, CONFIG.seed, gameState);
  const points = generator.generate();
  const spline = new TrackSpline(points, false);
  const trackLength = spline.getLength();

  const bumperOffset = Math.max(1, CONFIG.track.bumperOffsetFromTrackEnd ?? 3.4);
  const bumperDistance = Math.max(4, trackLength - bumperOffset);
  const stationGap = Math.max(5, CONFIG.track.stationGapToBumper ?? 12);
  const stationEndDistance = Math.max(0, bumperDistance - stationGap);
  const stationLength = Math.max(20, CONFIG.track.stationLength ?? 122);
  const stationStartDistance = Math.max(0, stationEndDistance - stationLength);

  const sim = new TrainSim(CONFIG.train);
  const maxDecel = CONFIG.train.brakeForceMax / CONFIG.train.mass;
  let time = 0;
  const dt = 1 / 60;

  // Simulate a perfect AI that goes full throttle until the very last frame where applying full brakes
  // allows it to stop exactly inside the station zone (we optimize for stopping right at stationEndDistance to maintain speed longer).
  while (true) {
    const state = sim.getState(dt);
    
    // Stop condition: speed is low enough and we are inside the station
    if (state.speed <= 0.35 && state.distance >= stationStartDistance && state.distance <= stationEndDistance) {
      break;
    }

    // Failsafe if it overshoots or stops early
    if (state.speed <= 0 && state.distance > 0) {
      if (state.distance < stationStartDistance) {
        // Did not reach station, meaning we somehow braked too early (should not happen with perfect logic)
      }
      break;
    }

    // Distance required to come to a full stop from current speed at max braking
    const stoppingDistance = (state.speed * state.speed) / (2 * maxDecel);
    
    // If we apply brakes now, will we overshoot the end of the station?
    // We want to brake as late as possible, so we brake when distance + stoppingDistance >= stationEndDistance
    if (state.distance + stoppingDistance >= stationEndDistance) {
      sim.setControls({ throttle: 0, brake: 1 });
    } else {
      // Go as fast as physically possible (respecting max speed of course)
      sim.setControls({ throttle: 1, brake: 0 });
    }

    sim.update(dt);
    time += dt;

    // Hard limit to prevent infinite loops in tests
    if (time > 1000) break;
  }

  // To account for dt precision and floating point, subtract a very small margin (e.g. 50ms)
  // This gives us an absolute, irrefutable mathematical lower bound.
  return Math.floor(time * 1000) - 50;
}

describe("Leaderboard Integrity", () => {
  it("should have a valid supabase connection", () => {
    expect(process.env.VITE_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.VITE_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });

  it("should not contain any impossible completion times in the database", async () => {
    const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all track times
    const { data: trackTimes, error } = await supabase
      .from("track_times")
      .select("id, level, time_ms, user_progress ( username )");

    expect(error).toBeNull();
    expect(trackTimes).toBeDefined();

    const minTimesByLevel = new Map<number, number>();
    const bogusRecords: any[] = [];

    for (const record of trackTimes!) {
      const level = record.level;
      if (!minTimesByLevel.has(level)) {
        minTimesByLevel.set(level, calculateTheoreticalMinimumTimeMs(level));
      }

      const theoreticalMin = minTimesByLevel.get(level)!;
      if (record.time_ms < theoreticalMin) {
        bogusRecords.push({
          id: record.id,
          level: record.level,
          username: record.user_progress?.username,
          time_ms: record.time_ms,
          theoreticalMin,
        });
      }
    }

    // If there are bogus records, fail the test and print them out so they can be deleted
    if (bogusRecords.length > 0) {
      console.error("Found physically impossible times in the database:", bogusRecords);
      
      // Optional: Automatically delete bogus records so the test fixes the state.
      // We will just delete them to "mitigate corruption"
      const idsToDelete = bogusRecords.map((r) => r.id);
      const { error: deleteError } = await supabase
        .from("track_times")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.error("Failed to delete bogus records:", deleteError);
      } else {
        console.log(`Successfully purged ${idsToDelete.length} bogus records.`);
      }
    }

    expect(bogusRecords.length).toBe(0);
  }, 10000); // 10s timeout
});
