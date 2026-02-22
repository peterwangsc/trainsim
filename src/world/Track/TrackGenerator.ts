import { Vector3 } from 'three';
import { clamp } from '../../util/Math';

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
};

export class TrackGenerator {
  constructor(
    private readonly seed: number,
    private readonly config: TrackGeneratorConfig
  ) {}

  generate(): Vector3[] {
    const points: Vector3[] = [new Vector3(0, 0, 0)];

    let x = 0;
    let z = 0;
    let heading = 0;
    let distanceAlongTrack = 0;
    let curvatureBias = 0;

    for (let i = 0; i < this.config.segmentCount; i += 1) {
      const nextDistance = distanceAlongTrack + this.config.segmentLength;
      const inStem = nextDistance <= this.config.stemLength;

      if (!inStem) {
        const distanceFromStem = nextDistance - this.config.stemLength;
        const distanceFromOrigin = Math.hypot(x, z);
        const noiseDistance =
          distanceFromStem + distanceFromOrigin * this.config.originWarpStrength;
        const macroNoise = this.sampleNoise(noiseDistance, this.config.curvatureNoiseScale, 11);
        const detailNoise = this.sampleNoise(noiseDistance, this.config.detailNoiseScale, 37);

        const rawCurvature =
          macroNoise * this.config.baseCurvaturePerMeter +
          detailNoise * this.config.detailCurvaturePerMeter;
        curvatureBias += (rawCurvature - curvatureBias) * this.config.biasTracking;

        let curvature = rawCurvature - curvatureBias;
        curvature += -heading * this.config.headingDamping;
        curvature += -x * this.config.lateralPull;

        const headingDelta = clamp(
          curvature * this.config.segmentLength,
          -this.config.maxHeadingDelta,
          this.config.maxHeadingDelta
        );
        heading += headingDelta;
      } else {
        heading = 0;
      }

      x += Math.sin(heading) * this.config.segmentLength;
      z += Math.cos(heading) * this.config.segmentLength;
      distanceAlongTrack = nextDistance;

      points.push(new Vector3(x, 0, z));
    }

    return points;
  }

  private sampleNoise(distance: number, frequency: number, seedOffset: number): number {
    const x = distance * frequency;
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const t = x - x0;
    const smooth = t * t * (3 - 2 * t);
    const a = this.hash01(x0 + seedOffset);
    const b = this.hash01(x1 + seedOffset);
    return (a + (b - a) * smooth) * 2 - 1;
  }

  private hash01(value: number): number {
    let x = (value | 0) ^ this.seed;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x ^= x >>> 16;
    return (x >>> 0) / 0x100000000;
  }
}
