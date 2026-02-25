import { MathUtils } from "three";
import { CONFIG } from "./Config";
import type { TrackEndLayout } from "../world/Track/TrackEndSet";

export type HudStatus = "running" | "won" | "failed";
export type FailureReason = "COMFORT" | "BUMPER" | null;

export enum GameStatus {
  Ready = "READY",
  Running = "RUNNING",
  Won = "WON",
  Failed = "FAILED",
}

export class GameState {
  public status = GameStatus.Ready;
  public failureReason: FailureReason = null;
  public distance = 0;
  public wrappedDistance = 0;
  public speed = 0;
  public safeSpeed = 0;
  public comfort = 100;
  public comfortRatio = 1;

  constructor(
    public readonly level: number,
    private readonly trackEndLayout: TrackEndLayout,
  ) {}

  reset(): void {
    this.status = GameStatus.Running;
    this.failureReason = null;
    this.distance = 0;
    this.wrappedDistance = 0;
    this.speed = 0;
    this.safeSpeed = 0;
    this.comfort = 100;
    this.comfortRatio = 1;
  }

  update(distance: number, wrappedDistance: number, speed: number, comfort: number, curvatureSafeSpeed: number): void {
    this.distance = distance;
    this.wrappedDistance = wrappedDistance;
    this.speed = speed;
    this.comfort = comfort;
    this.comfortRatio = MathUtils.clamp(comfort / CONFIG.comfort.max, 0, 1);

    const terminalGuidanceSafeSpeed = this.computeTerminalGuidanceSafeSpeed(distance);
    this.safeSpeed = Math.min(curvatureSafeSpeed, terminalGuidanceSafeSpeed);

    if (this.status === GameStatus.Running) {
      if (distance >= this.trackEndLayout.bumperDistance) {
        this.status = GameStatus.Failed;
        this.failureReason = "BUMPER";
      } else if (this.isStoppedInStation(distance, speed)) {
        this.status = GameStatus.Won;
      } else if (comfort <= 0) {
        this.status = GameStatus.Failed;
        this.failureReason = "COMFORT";
      }
    }
  }

  private computeTerminalGuidanceSafeSpeed(distance: number): number {
    const distanceToStationEnd = Math.max(
      0,
      this.trackEndLayout.stationEndDistance - distance,
    );
    if (distanceToStationEnd <= 0) {
      return 0;
    }

    const desiredDecel = 1.15;
    const safeSpeed = Math.sqrt(2 * desiredDecel * distanceToStationEnd);
    return MathUtils.clamp(safeSpeed, 0, CONFIG.minimap.safeSpeedMax);
  }

  private isStoppedInStation(distance: number, speed: number): boolean {
    return (
      speed <= CONFIG.terminal.stopSpeedThreshold &&
      distance >= this.trackEndLayout.stationStartDistance &&
      distance <= this.trackEndLayout.stationEndDistance
    );
  }

  getHudStatus(): HudStatus {
    if (this.status === GameStatus.Won) {
      return "won";
    }
    if (this.status === GameStatus.Failed) {
      return "failed";
    }
    return "running";
  }

  getStatusMessage(): string {
    if (this.status === GameStatus.Ready) {
      return `Drive to Level ${this.level} terminal and stop before the platform ends.`;
    }
    if (this.status === GameStatus.Won) {
      return "Station stop complete. You win.";
    }

    if (this.status === GameStatus.Failed) {
      if (this.failureReason === "BUMPER") {
        return "Bumper impact. You lose.";
      }
      return "Ride comfort collapsed. You lose.";
    }

    const distanceToStationEnd =
      this.trackEndLayout.stationEndDistance - this.distance;
    if (distanceToStationEnd > 260) {
      return `Level ${this.level} terminal in ${Math.ceil(distanceToStationEnd)} m`;
    }
    if (distanceToStationEnd > 80) {
      return `Station ahead. Begin braking (${Math.ceil(distanceToStationEnd)} m).`;
    }
    if (distanceToStationEnd > 0) {
      return `Stop before platform end: ${Math.max(1, Math.ceil(distanceToStationEnd))} m`;
    }

    const distanceToBumper = this.trackEndLayout.bumperDistance - this.distance;
    if (distanceToBumper > 0) {
      return `Past station end. Bumper in ${Math.max(1, Math.ceil(distanceToBumper))} m`;
    }

    return "Bumper impact. You lose.";
  }
}
