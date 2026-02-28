import { MathUtils } from "three";
import { CONFIG } from "./Config";
import { SceneSetup } from "../render/SceneSetup";

export type HudStatus = "running" | "won" | "failed";
export type FailureReason = "COMFORT" | "BUMPER" | null;

export enum GameStatus {
  Ready = "READY",
  Running = "RUNNING",
  Won = "WON",
  Failed = "FAILED",
}

export class GameState {
  public level: number = 1;
  public maxLevel: number = 1;
  public username: string | null;
  public userId: string;
  public status = GameStatus.Ready;
  public failureReason: FailureReason = null;
  public distance = 0;
  public wrappedDistance = 0;
  public speed = 0;
  public safeSpeed = 0;
  public comfort = 100;
  public comfortRatio = 1;
  public curvatureSafeSpeed = 0;
  public elapsedTime = 0;
  public expectedDuration = 0;
  public timeOfDayHours = 0;
  public expectedArrivalHours = 0;
  public masterVolume: number = 0.5;
  public musicVolume: number = 0.5;
  public sfxVolume: number = 0.5;
  public sceneSetup: SceneSetup | null = null;
  public config: typeof CONFIG;

  constructor(username: string | null, userId: string, config: typeof CONFIG) {
    this.username = username;
    this.userId = userId;
    this.config = config;
  }

  reset(): void {
    this.status = GameStatus.Running;
    this.failureReason = null;
    this.distance = 0;
    this.wrappedDistance = 0;
    this.speed = 0;
    this.safeSpeed = 0;
    this.comfort = 100;
    this.comfortRatio = 1;
    this.elapsedTime = 0;
  }

  update(updates: Partial<GameState>): void {
    Object.assign(this, updates);
    this.comfortRatio = MathUtils.clamp(
      this.comfort / this.config.comfort.max,
      0,
      1,
    );

    const terminalGuidanceSafeSpeed = this.computeTerminalGuidanceSafeSpeed(
      this.distance,
    );
    this.safeSpeed = Math.min(
      this.curvatureSafeSpeed,
      terminalGuidanceSafeSpeed,
    );

    if (this.status === GameStatus.Running) {
      const trackEndLayout = this.sceneSetup?.trackEndSet.getLayout();
      const hasHitBumper = trackEndLayout && this.distance >= trackEndLayout.bumperDistance;

      if (hasHitBumper) {
        this.status = GameStatus.Failed;
        this.failureReason = "BUMPER";
      } else if (this.isStoppedInStation(this.distance, this.speed)) {
        this.status = GameStatus.Won;
      } else if (this.comfort <= 0) {
        this.status = GameStatus.Failed;
        this.failureReason = "COMFORT";
      }
    }
  }

  private computeTerminalGuidanceSafeSpeed(distance: number): number {
    const trackEndLayout = this.sceneSetup?.trackEndSet.getLayout();
    if (!trackEndLayout) {
      return 0;
    }
    const distanceToStationEnd = Math.max(
      0,
      trackEndLayout.stationEndDistance - distance,
    );
    if (distanceToStationEnd <= 0) {
      return 0;
    }

    const desiredDecel = 1.15;
    const safeSpeed = Math.sqrt(2 * desiredDecel * distanceToStationEnd);
    return MathUtils.clamp(safeSpeed, 0, this.config.minimap.safeSpeedMax);
  }

  private isStoppedInStation(distance: number, speed: number): boolean {
    const trackEndLayout = this.sceneSetup?.trackEndSet.getLayout();
    if (!trackEndLayout) {
      return false;
    }
    return (
      speed <= this.config.terminal.stopSpeedThreshold &&
      distance >= trackEndLayout.stationStartDistance &&
      distance <= trackEndLayout.stationEndDistance
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

    const trackEndLayout = this.sceneSetup?.trackEndSet.getLayout();
    const distanceToStationEnd = trackEndLayout
      ? trackEndLayout.stationEndDistance - this.distance
      : Infinity;
    if (distanceToStationEnd > this.config.terminal.stationLength) {
      return `Level ${this.level} terminal in ${Math.ceil(distanceToStationEnd)} m`;
    }
    if (distanceToStationEnd > 80) {
      return `Station ahead. Begin braking (${Math.ceil(distanceToStationEnd)} m).`;
    }
    if (distanceToStationEnd > 0) {
      return `Stop before platform end: ${Math.max(1, Math.ceil(distanceToStationEnd))} m`;
    }

    const distanceToBumper = trackEndLayout
      ? trackEndLayout.bumperDistance - this.distance
      : Infinity;
    if (distanceToBumper > 0) {
      return `Past station end. Bumper in ${Math.max(1, Math.ceil(distanceToBumper))} m`;
    }

    return "Bumper impact. You lose.";
  }
}
