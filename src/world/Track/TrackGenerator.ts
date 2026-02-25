import { Vector3 } from "three";
import { CONFIG } from "../../game/Config";
import { clamp } from "../../util/Math";
import { GameState } from "../../game/GameState";

export type TrackGeneratorConfig = {
  segmentCount: number;
  segmentLength: number;
  stemLength: number;
  maxHeadingDelta: number;
  curvatureNoiseScale: number;
  detailNoiseScale: number;
  baseCurvaturePerMeter: number;
  detailCurvaturePerMeter: number;
  headingDamping: number;
  biasTracking: number;
  lateralPull: number;
  originWarpStrength: number;
  minSelfIntersectionDistance?: number;
  avoidanceHeadingStep?: number;
  avoidanceSweepSteps?: number;
  avoidanceRecentSegmentIgnore?: number;
  maxGenerationAttempts?: number;
};

export class TrackGenerator {
  private generationSeed: number;
  private config: TrackGeneratorConfig;

  constructor(
    config: TrackGeneratorConfig,
    seed: number,
    private readonly gameState: GameState,
  ) {
    this.generationSeed = seed + this.gameState.level - 1;
    this.config = config;
  }

  generate(): Vector3[] {
    const attemptCount = Math.max(1, this.config.maxGenerationAttempts ?? 8);
    let bestAttemptPoints: Vector3[] | null = null;
    let bestAttemptIntersectionCount = Number.POSITIVE_INFINITY;

    for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
      this.generationSeed = this.seedForAttempt(attemptIndex);
      const points = this.generateSingleTrack();
      const intersectionCount = this.countSelfIntersections(points);

      if (intersectionCount === 0) {
        return points;
      }

      if (intersectionCount < bestAttemptIntersectionCount) {
        bestAttemptPoints = points;
        bestAttemptIntersectionCount = intersectionCount;
      }
    }

    return bestAttemptPoints ?? this.generateSingleTrack();
  }

  private generateSingleTrack(): Vector3[] {
    const points: Vector3[] = [new Vector3(0, 0, 0)];

    let x = 0;
    let z = 0;
    let heading = 0;
    let distanceAlongTrack = 0;
    let curvatureBias = 0;

    for (let i = 0; i < this.config.segmentCount; i += 1) {
      const nextDistance = distanceAlongTrack + this.config.segmentLength;
      const inStem = nextDistance <= this.config.stemLength;
      let targetHeading = heading;

      if (!inStem) {
        const distanceFromStem = nextDistance - this.config.stemLength;
        const distanceFromOrigin = Math.hypot(x, z);
        const noiseDistance =
          distanceFromStem +
          distanceFromOrigin * this.config.originWarpStrength;
        const macroNoise = this.sampleNoise(
          noiseDistance,
          this.config.curvatureNoiseScale,
          11,
        );
        const detailNoise = this.sampleNoise(
          noiseDistance,
          this.config.detailNoiseScale,
          37,
        );

        const rawCurvature =
          macroNoise * this.config.baseCurvaturePerMeter +
          detailNoise * this.config.detailCurvaturePerMeter;
        curvatureBias +=
          (rawCurvature - curvatureBias) * this.config.biasTracking;

        let curvature = rawCurvature - curvatureBias;
        curvature += -heading * this.config.headingDamping;
        curvature += -x * this.config.lateralPull;

        const headingDelta = clamp(
          curvature * this.config.segmentLength,
          -this.config.maxHeadingDelta,
          this.config.maxHeadingDelta,
        );
        targetHeading += headingDelta;
      } else {
        targetHeading = 0;
      }

      heading = this.resolveHeadingWithSelfAvoidance(
        points,
        x,
        z,
        heading,
        targetHeading,
      );

      x += Math.sin(heading) * this.config.segmentLength;
      z += Math.cos(heading) * this.config.segmentLength;
      distanceAlongTrack = nextDistance;

      points.push(new Vector3(x, 0, z));
    }

    return points;
  }

  private countSelfIntersections(points: Vector3[]): number {
    const segmentCount = points.length - 1;
    if (segmentCount <= 2) {
      return 0;
    }

    let intersections = 0;
    for (let i = 0; i < segmentCount; i += 1) {
      const a = points[i];
      const b = points[i + 1];

      for (let j = i + 2; j < segmentCount; j += 1) {
        if (i === 0 && j === segmentCount - 1) {
          continue;
        }

        const c = points[j];
        const d = points[j + 1];
        if (this.segmentsIntersectXZ(a.x, a.z, b.x, b.z, c.x, c.z, d.x, d.z)) {
          intersections += 1;
        }
      }
    }

    return intersections;
  }

  private sampleNoise(
    distance: number,
    frequency: number,
    seedOffset: number,
  ): number {
    const x = distance * frequency;
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const t = x - x0;
    const smooth = t * t * (3 - 2 * t);
    const a = this.hash01(x0 + seedOffset);
    const b = this.hash01(x1 + seedOffset);
    return (a + (b - a) * smooth) * 2 - 1;
  }

  private resolveHeadingWithSelfAvoidance(
    points: Vector3[],
    startX: number,
    startZ: number,
    previousHeading: number,
    targetHeading: number,
  ): number {
    const maxHeadingDelta = this.config.maxHeadingDelta;
    const baseHeadingDelta = clamp(
      targetHeading - previousHeading,
      -maxHeadingDelta,
      maxHeadingDelta,
    );
    const headingStep =
      this.config.avoidanceHeadingStep ?? Math.max(0.004, maxHeadingDelta / 16);
    const sweepSteps =
      this.config.avoidanceSweepSteps ??
      Math.max(8, Math.ceil(maxHeadingDelta / headingStep));
    const minClearance =
      this.config.minSelfIntersectionDistance ??
      this.config.segmentLength * 0.75;
    const minClearanceSq = minClearance * minClearance;
    const recentSegmentIgnore = Math.max(
      1,
      this.config.avoidanceRecentSegmentIgnore ?? 1,
    );

    const visitedDeltas = new Set<number>();
    let bestHeading = previousHeading + baseHeadingDelta;
    let bestClearanceSq = -1;
    let bestDeltaPenalty = Number.POSITIVE_INFINITY;

    const tryDelta = function (
      this: TrackGenerator,
      candidateHeadingDelta: number,
    ): boolean {
      const clampedDelta = clamp(
        candidateHeadingDelta,
        -maxHeadingDelta,
        maxHeadingDelta,
      );
      const deltaKey = Math.round(clampedDelta * 1_000_000);

      if (visitedDeltas.has(deltaKey)) {
        return false;
      }
      visitedDeltas.add(deltaKey);

      const candidateHeading = previousHeading + clampedDelta;
      const candidateEndX =
        startX + Math.sin(candidateHeading) * this.config.segmentLength;
      const candidateEndZ =
        startZ + Math.cos(candidateHeading) * this.config.segmentLength;
      const clearanceSq = this.measureCandidateClearanceSq(
        points,
        startX,
        startZ,
        candidateEndX,
        candidateEndZ,
        recentSegmentIgnore,
      );
      const deltaPenalty = Math.abs(clampedDelta - baseHeadingDelta);

      if (
        clearanceSq > bestClearanceSq ||
        (Math.abs(clearanceSq - bestClearanceSq) <= 1e-6 &&
          deltaPenalty < bestDeltaPenalty)
      ) {
        bestHeading = candidateHeading;
        bestClearanceSq = clearanceSq;
        bestDeltaPenalty = deltaPenalty;
      }

      return clearanceSq >= minClearanceSq;
    }.bind(this);

    if (tryDelta(baseHeadingDelta)) {
      return bestHeading;
    }

    for (let step = 1; step <= sweepSteps; step += 1) {
      const sweepAmount = step * headingStep;
      if (tryDelta(baseHeadingDelta + sweepAmount)) {
        return bestHeading;
      }
      if (tryDelta(baseHeadingDelta - sweepAmount)) {
        return bestHeading;
      }
    }

    return bestHeading;
  }

  private measureCandidateClearanceSq(
    points: Vector3[],
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    recentSegmentIgnore: number,
  ): number {
    const lastSegmentIndex = points.length - 2 - recentSegmentIgnore;
    if (lastSegmentIndex < 0) {
      return Number.POSITIVE_INFINITY;
    }

    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (
      let segmentIndex = 0;
      segmentIndex <= lastSegmentIndex;
      segmentIndex += 1
    ) {
      const segmentStart = points[segmentIndex];
      const segmentEnd = points[segmentIndex + 1];
      const ax = segmentStart.x;
      const az = segmentStart.z;
      const bx = segmentEnd.x;
      const bz = segmentEnd.z;

      if (
        this.segmentsIntersectXZ(startX, startZ, endX, endZ, ax, az, bx, bz)
      ) {
        return -1;
      }

      const distanceSq = this.segmentDistanceSqXZ(
        startX,
        startZ,
        endX,
        endZ,
        ax,
        az,
        bx,
        bz,
      );
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
      }
    }

    return nearestDistanceSq;
  }

  private segmentDistanceSqXZ(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cx: number,
    cz: number,
    dx: number,
    dz: number,
  ): number {
    return Math.min(
      this.pointToSegmentDistanceSqXZ(ax, az, cx, cz, dx, dz),
      this.pointToSegmentDistanceSqXZ(bx, bz, cx, cz, dx, dz),
      this.pointToSegmentDistanceSqXZ(cx, cz, ax, az, bx, bz),
      this.pointToSegmentDistanceSqXZ(dx, dz, ax, az, bx, bz),
    );
  }

  private pointToSegmentDistanceSqXZ(
    px: number,
    pz: number,
    ax: number,
    az: number,
    bx: number,
    bz: number,
  ): number {
    const abx = bx - ax;
    const abz = bz - az;
    const abLengthSq = abx * abx + abz * abz;
    if (abLengthSq <= 1e-6) {
      const dx = px - ax;
      const dz = pz - az;
      return dx * dx + dz * dz;
    }

    const t = clamp(((px - ax) * abx + (pz - az) * abz) / abLengthSq, 0, 1);
    const closestX = ax + abx * t;
    const closestZ = az + abz * t;
    const dx = px - closestX;
    const dz = pz - closestZ;
    return dx * dx + dz * dz;
  }

  private segmentsIntersectXZ(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cx: number,
    cz: number,
    dx: number,
    dz: number,
  ): boolean {
    const epsilon = 1e-6;
    const o1 = this.orientationXZ(ax, az, bx, bz, cx, cz);
    const o2 = this.orientationXZ(ax, az, bx, bz, dx, dz);
    const o3 = this.orientationXZ(cx, cz, dx, dz, ax, az);
    const o4 = this.orientationXZ(cx, cz, dx, dz, bx, bz);

    const intersectsProperly =
      ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon)) &&
      ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon));
    if (intersectsProperly) {
      return true;
    }

    return (
      (Math.abs(o1) <= epsilon &&
        this.onSegmentXZ(ax, az, bx, bz, cx, cz, epsilon)) ||
      (Math.abs(o2) <= epsilon &&
        this.onSegmentXZ(ax, az, bx, bz, dx, dz, epsilon)) ||
      (Math.abs(o3) <= epsilon &&
        this.onSegmentXZ(cx, cz, dx, dz, ax, az, epsilon)) ||
      (Math.abs(o4) <= epsilon &&
        this.onSegmentXZ(cx, cz, dx, dz, bx, bz, epsilon))
    );
  }

  private orientationXZ(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cx: number,
    cz: number,
  ): number {
    return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  }

  private onSegmentXZ(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    px: number,
    pz: number,
    epsilon: number,
  ): boolean {
    return (
      px >= Math.min(ax, bx) - epsilon &&
      px <= Math.max(ax, bx) + epsilon &&
      pz >= Math.min(az, bz) - epsilon &&
      pz <= Math.max(az, bz) + epsilon
    );
  }

  private seedForAttempt(attemptIndex: number): number {
    if (attemptIndex === 0) {
      return this.generationSeed;
    }

    return (this.generationSeed ^ Math.imul(attemptIndex, 0x9e3779b9)) | 0;
  }

  private hash01(value: number): number {
    let x = (value | 0) ^ this.generationSeed;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x ^= x >>> 16;
    return (x >>> 0) / 0x100000000;
  }
}
