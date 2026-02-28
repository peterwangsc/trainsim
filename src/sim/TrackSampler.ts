import { Vector3 } from "three";
import { clamp } from "../util/Math";
import { curvatureAtDistance } from "../world/Track/Curvature";
import { TrackSpline } from "../world/Track/TrackSpline";

const UP = new Vector3(0, 1, 0);

export type CurvaturePreviewSample = {
  distanceAhead: number;
  curvature: number;
  safeSpeed: number;
  lateral: number;
  forward: number;
};

export type MinimapPathPoint = {
  distanceAhead: number;
  lateral: number;
  forward: number;
};

export type TrackSamplerConfig = {
  previewDistances: readonly number[];
  pathLookAheadDistance: number;
  pathSampleSpacing: number;
  safeSpeedBase: number;
  safeSpeedMin: number;
  safeSpeedMax: number;
  curvatureEpsilon: number;
};

export class TrackSampler {
  private readonly origin = new Vector3();
  private readonly tangent = new Vector3();
  private readonly right = new Vector3();
  private readonly delta = new Vector3();
  private spline!: TrackSpline;

  constructor(
    spline: TrackSpline,
    private readonly config: TrackSamplerConfig,
  ) {
    this.spline = spline;
  }

  updateSpline(spline: TrackSpline): void {
    this.spline = spline;
  }

  sampleAhead(distance: number): CurvaturePreviewSample[] {
    this.prepareFrame(distance);

    return this.config.previewDistances.map((distanceAhead) => {
      const sampleDistance = distance + distanceAhead;
      const curvature = curvatureAtDistance(this.spline, sampleDistance);
      const safeSpeed = clamp(
        (this.config.safeSpeedBase /
          Math.sqrt(Math.abs(curvature) + this.config.curvatureEpsilon)) *
          0.22,
        this.config.safeSpeedMin,
        this.config.safeSpeedMax,
      );
      const { lateral, forward } =
        this.sampleRelativeCoordinates(sampleDistance);
      console.log(
        "safeSpeed raw",
        (this.config.safeSpeedBase /
          Math.sqrt(Math.abs(curvature) + this.config.curvatureEpsilon)) *
          0.22,
      );
      return {
        distanceAhead,
        curvature,
        safeSpeed,
        lateral,
        forward,
      };
    });
  }

  samplePathAhead(distance: number): MinimapPathPoint[] {
    this.prepareFrame(distance);

    const lookAhead = Math.max(1, this.config.pathLookAheadDistance);
    const spacing = Math.max(0.5, this.config.pathSampleSpacing);
    const points: MinimapPathPoint[] = [];

    for (
      let distanceAhead = 0;
      distanceAhead <= lookAhead;
      distanceAhead += spacing
    ) {
      const sampleDistance = distance + distanceAhead;
      const { lateral, forward } =
        this.sampleRelativeCoordinates(sampleDistance);
      points.push({ distanceAhead, lateral, forward });
    }

    const lastPoint = points[points.length - 1];
    if (!lastPoint || lastPoint.distanceAhead < lookAhead) {
      const sampleDistance = distance + lookAhead;
      const { lateral, forward } =
        this.sampleRelativeCoordinates(sampleDistance);
      points.push({ distanceAhead: lookAhead, lateral, forward });
    }

    return points;
  }

  private prepareFrame(distance: number): void {
    this.origin.copy(this.spline.getPositionAtDistance(distance));
    this.tangent.copy(this.spline.getTangentAtDistance(distance));
    this.right.crossVectors(this.tangent, UP).normalize();
  }

  private sampleRelativeCoordinates(sampleDistance: number): {
    lateral: number;
    forward: number;
  } {
    this.delta
      .copy(this.spline.getPositionAtDistance(sampleDistance))
      .sub(this.origin);

    return {
      lateral: this.delta.dot(this.right),
      forward: Math.max(0, this.delta.dot(this.tangent)),
    };
  }
}
