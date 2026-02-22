import { clamp } from '../util/Math';

export type ComfortConfig = {
  max: number;
  regenRate: number;
  overspeedPenaltyRate: number;
  hardBrakeThreshold: number;
  hardBrakePenaltyRate: number;
  jerkThreshold: number;
  jerkPenaltyRate: number;
};

export type ComfortInput = {
  speed: number;
  safeSpeed: number;
  accel: number;
  jerk: number;
};

export class ComfortModel {
  private comfort: number;

  constructor(private readonly config: ComfortConfig) {
    this.comfort = config.max;
  }

  update(input: ComfortInput, dt: number): number {
    const overspeed = Math.max(0, input.speed - input.safeSpeed);
    const overspeedPenalty = overspeed * this.config.overspeedPenaltyRate;

    const hardBrakeAmount = input.accel < this.config.hardBrakeThreshold
      ? this.config.hardBrakeThreshold - input.accel
      : 0;
    const hardBrakePenalty = hardBrakeAmount * this.config.hardBrakePenaltyRate;

    const jerkPenalty = Math.max(0, Math.abs(input.jerk) - this.config.jerkThreshold)
      * this.config.jerkPenaltyRate;

    const totalPenalty = overspeedPenalty + hardBrakePenalty + jerkPenalty;
    const regen = totalPenalty === 0 ? this.config.regenRate : 0;

    this.comfort = clamp(this.comfort + (regen - totalPenalty) * dt, 0, this.config.max);
    return this.comfort;
  }

  getComfort(): number {
    return this.comfort;
  }

  reset(): void {
    this.comfort = this.config.max;
  }
}
