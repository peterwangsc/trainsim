import { MathUtils } from "three";
import { CONFIG } from "./Config";
import { GameState, GameStatus, FailureReason } from "./GameState";
import { TrackEndLayout } from "../world/Track/TrackEndSet";

export class RuleEngine {
  private layout: TrackEndLayout | null = null;

  constructor(private readonly config: typeof CONFIG) {}

  setLayout(layout: TrackEndLayout): void {
    this.layout = layout;
  }

  computeSafeSpeed(distance: number, curvatureSafeSpeed: number): number {
    return Math.min(curvatureSafeSpeed, this.computeTerminalGuidanceSafeSpeed(distance));
  }

  private computeTerminalGuidanceSafeSpeed(distance: number): number {
    if (!this.layout) return this.config.minimap.safeSpeedMax;
    const distanceToStationEnd = Math.max(0, this.layout.stationEndDistance - distance);
    if (distanceToStationEnd <= 0) return 0;
    const desiredDecel = 1.15;
    const safeSpeed = Math.sqrt(2 * desiredDecel * distanceToStationEnd);
    return MathUtils.clamp(safeSpeed, 0, this.config.minimap.safeSpeedMax);
  }

  checkTransition(
    distance: number,
    speed: number,
    comfort: number,
    currentStatus: GameStatus,
  ): { status: GameStatus; failureReason: FailureReason } | null {
    if (currentStatus !== GameStatus.Running || !this.layout) return null;

    if (distance >= this.layout.bumperDistance) {
      return { status: GameStatus.Failed, failureReason: "BUMPER" };
    }
    if (
      speed <= this.config.terminal.stopSpeedThreshold &&
      distance >= this.layout.stationStartDistance &&
      distance <= this.layout.stationEndDistance
    ) {
      return { status: GameStatus.Won, failureReason: null };
    }
    if (comfort <= 0) {
      return { status: GameStatus.Failed, failureReason: "COMFORT" };
    }
    return null;
  }

  getStatusMessage(state: GameState): string {
    if (state.status === GameStatus.Ready) {
      return `Drive to Level ${state.level} terminal and stop before the platform ends.`;
    }
    if (state.status === GameStatus.Won) {
      return "Station stop complete. You win.";
    }
    if (state.status === GameStatus.Failed) {
      return state.failureReason === "BUMPER"
        ? "Bumper impact. You lose."
        : "Ride comfort collapsed. You lose.";
    }

    if (!this.layout) {
      return `Level ${state.level} terminal ahead.`;
    }

    const distanceToStationEnd = this.layout.stationEndDistance - state.distance;
    if (distanceToStationEnd > this.config.terminal.stationLength) {
      return `Level ${state.level} terminal in ${Math.ceil(distanceToStationEnd)} m`;
    }
    if (distanceToStationEnd > 80) {
      return `Station ahead. Begin braking (${Math.ceil(distanceToStationEnd)} m).`;
    }
    if (distanceToStationEnd > 0) {
      return `Stop before platform end: ${Math.max(1, Math.ceil(distanceToStationEnd))} m`;
    }

    const distanceToBumper = this.layout.bumperDistance - state.distance;
    if (distanceToBumper > 0) {
      return `Past station end. Bumper in ${Math.max(1, Math.ceil(distanceToBumper))} m`;
    }

    return "Bumper impact. You lose.";
  }
}
