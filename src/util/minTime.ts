import { CONFIG } from "@/game/Config";
import { GameState } from "@/game/GameState";
import { TrackGenerator } from "@/world/Track/TrackGenerator";
import { TrackSpline } from "@/world/Track/TrackSpline";
import { TrainSim } from "@/sim/TrainSim";

/**
 * Computes the theoretical minimum completion time for a given level by
 * simulating a perfect AI: full throttle until the last possible moment,
 * then full brakes to stop inside the station zone.
 *
 * Returns a lower bound in milliseconds (with a small margin for float precision).
 */
export function calculateTheoreticalMinimumTimeMs(level: number): number {
  const gameState = new GameState(null, "min_time");
  gameState.level = level;

  const generator = new TrackGenerator(CONFIG.track, CONFIG.seed, gameState);
  const points = generator.generate();
  const spline = new TrackSpline(points, {});
  const trackLength = spline.getLength();

  const bumperDistance = Math.max(4, trackLength - CONFIG.terminal.bumperOffsetFromTrackEnd);
  const stationEndDistance = Math.max(0, bumperDistance - CONFIG.terminal.stationGapToBumper);
  const stationStartDistance = Math.max(0, stationEndDistance - CONFIG.terminal.stationLength);

  const sim = new TrainSim(CONFIG.train);
  const maxDecel = CONFIG.train.brakeForceMax / CONFIG.train.mass;
  let time = 0;
  const dt = 1 / 60;

  while (true) {
    const state = sim.getState(dt);

    if (state.speed <= 0.35 && state.distance >= stationStartDistance && state.distance <= stationEndDistance) {
      break;
    }
    if (state.speed <= 0 && state.distance > 0) break;
    if (time > 1000) break; // safety limit

    const stoppingDistance = (state.speed * state.speed) / (2 * maxDecel);
    if (state.distance + stoppingDistance >= stationEndDistance) {
      sim.setControls({ throttle: 0, brake: 1 });
    } else {
      sim.setControls({ throttle: 1, brake: 0 });
    }

    sim.update(dt);
    time += dt;
  }

  // Subtract a small margin to account for dt precision and floating point.
  return Math.floor(time * 1000) - 50;
}
