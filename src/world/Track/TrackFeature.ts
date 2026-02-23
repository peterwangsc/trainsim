import { Group } from "three";
import { TrackSpline } from "./TrackSpline";

export type EnvironmentEffect = {
  ambientMultiplier?: number; // 0 = pitch black, 1 = normal
};

export abstract class TrackFeature {
  readonly root = new Group();

  constructor(
    protected readonly spline: TrackSpline,
    readonly startDistance: number,
    readonly endDistance?: number,
  ) {}

  update(_trainDistance: number, _dt: number): void {}

  getEnvironmentEffect(_t: number): EnvironmentEffect | null {
    return null;
  }

  abstract dispose(): void;
}
