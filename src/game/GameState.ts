export type FailureReason = "COMFORT" | "BUMPER" | null;

export enum GameStatus {
  Ready = "READY",
  Running = "RUNNING",
  Won = "WON",
  Failed = "FAILED",
}

export class GameState {
  public level: number = 1;
  public maxLevel: number = 1; // user's user_progress.level
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

  constructor(username: string | null, userId: string) {
    this.username = username;
    this.userId = userId;
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
  }
}
