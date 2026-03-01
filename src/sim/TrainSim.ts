import { clamp } from "@/util/Math";

export type TrainControls = {
  throttle: number;
  brake: number;
};

export type TrainSimConfig = {
  mass: number;
  tractionForceMax: number;
  brakeForceMax: number;
  dragCoefficient: number;
  rollingResistance: number;
  maxSpeed: number;
};

export type TrainState = {
  speed: number;
  distance: number;
  accel: number;
  jerk: number;
};

export class TrainSim {
  private throttle = 0;
  private brake = 0;
  private speed = 0;
  private distance = 0;
  private accel = 0;
  private prevAccel = 0;
  private jerk = 0;

  constructor(private readonly config: TrainSimConfig) {}

  setControls(controls: TrainControls): void {
    this.throttle = clamp(controls.throttle, 0, 1);
    this.brake = clamp(controls.brake, 0, 1);
  }

  update(dt: number): void {
    this.jerk = dt !== 0 ? (this.accel - this.prevAccel) / dt : 0;
    this.prevAccel = this.accel;
    const tractionFactor =
      1 - Math.min(this.speed / (this.config.maxSpeed * 1.15), 0.95);
    const traction =
      this.throttle * this.config.tractionForceMax * tractionFactor;
    const brake = this.brake * this.config.brakeForceMax;
    const drag = this.config.dragCoefficient * this.speed * this.speed;
    const roll = this.config.rollingResistance;

    const netForce = traction - brake - drag - roll;

    this.accel = netForce / this.config.mass;
    this.speed = clamp(this.speed + this.accel * dt, 0, this.config.maxSpeed);
    this.distance += this.speed * dt;
  }

  getState(dt: number): TrainState {
    return {
      speed: this.speed,
      distance: this.distance,
      accel: this.accel,
      jerk: this.jerk,
    };
  }

  getControls(): TrainControls {
    return {
      throttle: this.throttle,
      brake: this.brake,
    };
  }

  reset(): void {
    this.throttle = 0;
    this.brake = 0;
    this.speed = 0;
    this.distance = 0;
    this.accel = 0;
    this.prevAccel = 0;
  }
}
