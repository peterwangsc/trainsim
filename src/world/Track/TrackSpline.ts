import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';

export type TrackSplineOptions = {
  closed?: boolean;
};

export class TrackSpline {
  private readonly curve: CatmullRomCurve3;
  private readonly length: number;
  private readonly closed: boolean;

  constructor(points: Vector3[], options: TrackSplineOptions = {}) {
    this.closed = options.closed ?? false;
    this.curve = new CatmullRomCurve3(points, this.closed, 'catmullrom', 0.5);
    this.length = this.curve.getLength();
  }

  getLength(): number {
    return this.length;
  }

  isClosed(): boolean {
    return this.closed;
  }

  getPositionAtDistance(distance: number): Vector3 {
    return this.curve.getPointAt(this.distanceToT(distance));
  }

  getTangentAtDistance(distance: number): Vector3 {
    return this.curve.getTangentAt(this.distanceToT(distance)).normalize();
  }

  getNormalAtDistance(distance: number): Vector3 {
    const tangent = this.getTangentAtDistance(distance);
    const up = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(tangent, up).normalize();

    return new Vector3().crossVectors(right, tangent).normalize();
  }

  private distanceToT(distance: number): number {
    if (this.length <= 1e-6) {
      return 0;
    }

    const resolvedDistance = this.closed
      ? ((distance % this.length) + this.length) % this.length
      : MathUtils.clamp(distance, 0, this.length);

    return resolvedDistance / this.length;
  }
}
