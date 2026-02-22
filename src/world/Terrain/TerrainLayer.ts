import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Vector3
} from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { TrackSpline } from '../Track/TrackSpline';

export type TerrainConfig = {
  worldSize: number;
  gridResolution: number;
  maxHeight: number;
  noiseScale: number;
  noiseOctaves: number;
  noisePersistence: number;
  noiseLacunarity: number;
  trackSampleSpacing: number;
  trackFlattenInner: number;
  trackFlattenOuter: number;
  trackBedInset: number;
  trackBulgeHeight: number;
  trackBulgeRadius: number;
  trackShoulderOffset: number;
  trackShoulderWidth: number;
  trackShoulderDepth: number;
  mountainBlendRadius: number;
  radialRiseStart: number;
  radialRiseRange: number;
  radialRiseHeight: number;
  radialRisePower: number;
  radialRiseNoiseScale: number;
  radialRiseNoiseStrength: number;
};

type HeightMapBuildResult = {
  data: Float32Array;
  width: number;
  depth: number;
};

type TrackProximity = {
  distance: number;
  trackHeight: number;
};

export class TerrainLayer {
  private readonly root = new Group();
  private readonly mesh: Mesh;
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly texture: CanvasTexture;

  private readonly noise = new ImprovedNoise();
  private readonly noiseZ: number;
  private readonly worldHalfSize: number;
  private readonly trackSamples: Float32Array;
  private heightData: Float32Array = new Float32Array(0);
  private heightFieldWidth = 0;
  private heightFieldDepth = 0;
  private simplexNoiseData: Float32Array | null = null;
  private simplexNoiseWidth = 0;
  private simplexNoiseHeight = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly spline: TrackSpline,
    private readonly seed: number,
    private readonly config: TerrainConfig
  ) {
    this.worldHalfSize = this.config.worldSize * 0.5;
    this.noiseZ = this.seed * 0.0127 + 17.3;
    this.trackSamples = this.buildTrackSamples();

    const { data, width, depth } = this.buildHeightData();
    this.heightData = data;
    this.heightFieldWidth = width;
    this.heightFieldDepth = depth;
    this.geometry = new PlaneGeometry(
      this.config.worldSize,
      this.config.worldSize,
      width - 1,
      depth - 1
    );
    this.geometry.rotateX(-Math.PI * 0.5);
    this.applyHeightsToGeometry(this.geometry, data);

    this.texture = new CanvasTexture(this.generateTerrainTexture(data, width, depth));
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.colorSpace = SRGBColorSpace;

    this.material = new MeshStandardMaterial({
      map: this.texture,
      roughness: 0.94,
      metalness: 0.02
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    this.root.name = 'terrain-layer';
    this.root.add(this.mesh);
    this.scene.add(this.root);

    this.loadSimplexNoiseTexture();
  }

  getHeightAt(worldX: number, worldZ: number): number {
    return this.sampleHeightFieldAt(worldX, worldZ);
  }

  getDistanceToTrack(worldX: number, worldZ: number): number {
    return this.getTrackProximity(worldX, worldZ).distance;
  }

  dispose(): void {
    this.disposed = true;
    this.scene.remove(this.root);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private buildTrackSamples(): Float32Array {
    const trackLength = this.spline.getLength();
    const spacing = Math.max(6, this.config.trackSampleSpacing);
    const count = this.spline.isClosed()
      ? Math.max(2, Math.ceil(trackLength / spacing))
      : Math.max(2, Math.floor(trackLength / spacing) + 1);
    const samples = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const distance = this.spline.isClosed()
        ? (i / count) * trackLength
        : (i / (count - 1)) * trackLength;
      const position = this.spline.getPositionAtDistance(distance);
      samples[i * 3] = position.x;
      samples[i * 3 + 1] = position.y;
      samples[i * 3 + 2] = position.z;
    }

    return samples;
  }

  private buildHeightData(): HeightMapBuildResult {
    const width = Math.max(64, this.config.gridResolution);
    const depth = Math.max(64, this.config.gridResolution);
    const data = new Float32Array(width * depth);

    for (let z = 0; z < depth; z += 1) {
      const nz = z / (depth - 1);
      const worldZ = MathUtils.lerp(-this.worldHalfSize, this.worldHalfSize, nz);

      for (let x = 0; x < width; x += 1) {
        const nx = x / (width - 1);
        const worldX = MathUtils.lerp(-this.worldHalfSize, this.worldHalfSize, nx);
        data[x + z * width] = this.evaluateProceduralHeightAt(worldX, worldZ);
      }
    }

    return { data, width, depth };
  }

  private evaluateProceduralHeightAt(worldX: number, worldZ: number): number {
    const proximity = this.getTrackProximity(worldX, worldZ);
    const embankmentHeight = this.sampleTrackBulgeHeight(
      proximity.distance,
      proximity.trackHeight
    );
    const radialRise = this.sampleRadialRiseHeight(
      proximity.distance,
      worldX,
      worldZ
    );
    const mountainHeight = this.sampleBaseHeight(worldX, worldZ) + radialRise;
    const transitionStart = Math.max(
      this.config.trackFlattenOuter,
      this.config.trackBulgeRadius +
      this.config.trackShoulderOffset +
      this.config.trackShoulderWidth * 1.5
    );
    const mountainBlendRadius = Math.max(
      transitionStart + 1,
      this.config.mountainBlendRadius
    );
    const mountainBlend = MathUtils.smoothstep(
      proximity.distance,
      transitionStart,
      mountainBlendRadius
    );
    const mountainLandscape = Math.max(embankmentHeight, mountainHeight);

    return MathUtils.lerp(embankmentHeight, mountainLandscape, mountainBlend);
  }

  private sampleRadialRiseHeight(
    distanceToTrack: number,
    worldX: number,
    worldZ: number
  ): number {
    const start = Math.max(this.config.trackFlattenOuter + 1, this.config.radialRiseStart);
    const range = Math.max(1, this.config.radialRiseRange);
    const normalized = MathUtils.clamp((distanceToTrack - start) / range, 0, 1);
    const rise = Math.pow(normalized, Math.max(0.1, this.config.radialRisePower));
    const noiseFactor = MathUtils.lerp(
      1 - this.config.radialRiseNoiseStrength,
      1 + this.config.radialRiseNoiseStrength,
      this.sampleSimplexNoise(worldX + 540, worldZ - 420, this.config.radialRiseNoiseScale)
    );

    return rise * this.config.radialRiseHeight * noiseFactor;
  }

  private sampleTrackBulgeHeight(distanceToTrack: number, trackHeight: number): number {
    const crestRadius = Math.max(0.5, this.config.trackBulgeRadius);
    const crestFactor = 1 - MathUtils.smoothstep(distanceToTrack, 0, crestRadius);
    const shoulderCenter = crestRadius + Math.max(0, this.config.trackShoulderOffset);
    const shoulderWidth = Math.max(0.5, this.config.trackShoulderWidth);
    const shoulderOffset = (distanceToTrack - shoulderCenter) / shoulderWidth;
    const shoulderMask = Math.exp(-0.5 * shoulderOffset * shoulderOffset);
    const railBedBase = trackHeight - this.config.trackBedInset;

    return (
      railBedBase +
      crestFactor * this.config.trackBulgeHeight -
      shoulderMask * this.config.trackShoulderDepth
    );
  }

  private applyHeightsToGeometry(geometry: PlaneGeometry, data: Float32Array): void {
    const positions = geometry.attributes.position as BufferAttribute;
    const vertices = positions.array as Float32Array;

    for (let i = 0, vertex = 0; i < data.length; i += 1, vertex += 3) {
      vertices[vertex + 1] = data[i];
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private sampleBaseHeight(worldX: number, worldZ: number): number {
    let amplitude = 1;
    let frequency = 1 / Math.max(1, this.config.noiseScale);
    let sum = 0;
    let amplitudeSum = 0;

    const warpX =
      (this.sampleSimplexNoise(worldX + 180, worldZ - 90, 0.0045) - 0.5) * 140;
    const warpZ =
      (this.sampleSimplexNoise(worldX - 220, worldZ + 130, 0.0045) - 0.5) * 140;
    const warpedX = worldX + warpX;
    const warpedZ = worldZ + warpZ;

    for (let octave = 0; octave < this.config.noiseOctaves; octave += 1) {
      const perlinSample = this.noise.noise(
        (warpedX + this.seed * 31.1) * frequency,
        (warpedZ - this.seed * 17.7) * frequency,
        this.noiseZ + octave * 9.1
      );
      const simplexSample = this.sampleSimplexNoise(
        warpedX + octave * 47.3,
        warpedZ - octave * 61.7,
        frequency * 46 + 0.003
      );
      const ridgePerlin = Math.pow(Math.abs(perlinSample), 1.1);
      const ridgeSimplex = Math.pow(Math.abs(simplexSample * 2 - 1), 1.05);
      const octaveSample = ridgePerlin * 0.68 + ridgeSimplex * 0.32;

      sum += octaveSample * amplitude;
      amplitudeSum += amplitude;
      amplitude *= this.config.noisePersistence;
      frequency *= this.config.noiseLacunarity;
    }

    const normalized = sum / Math.max(amplitudeSum, 1e-6);
    const macroMask = MathUtils.lerp(
      0.82,
      1.22,
      this.sampleSimplexNoise(worldX + 330, worldZ - 240, 0.0018)
    );
    const shaped = Math.pow(MathUtils.clamp(normalized, 0, 1.5), 1.48) * macroMask;
    return shaped * this.config.maxHeight - 0.5;
  }

  private sampleHeightFieldAt(worldX: number, worldZ: number): number {
    if (this.heightData.length === 0 || this.heightFieldWidth <= 1 || this.heightFieldDepth <= 1) {
      return this.evaluateProceduralHeightAt(worldX, worldZ);
    }

    const normalizedX = MathUtils.clamp(
      (worldX + this.worldHalfSize) / this.config.worldSize,
      0,
      1
    );
    const normalizedZ = MathUtils.clamp(
      (worldZ + this.worldHalfSize) / this.config.worldSize,
      0,
      1
    );

    const gridX = normalizedX * (this.heightFieldWidth - 1);
    const gridZ = normalizedZ * (this.heightFieldDepth - 1);
    const cellX = Math.min(Math.floor(gridX), this.heightFieldWidth - 2);
    const cellZ = Math.min(Math.floor(gridZ), this.heightFieldDepth - 2);
    const fx = gridX - cellX;
    const fz = gridZ - cellZ;

    const h00 = this.heightData[cellX + cellZ * this.heightFieldWidth];
    const h10 = this.heightData[cellX + 1 + cellZ * this.heightFieldWidth];
    const h01 = this.heightData[cellX + (cellZ + 1) * this.heightFieldWidth];
    const h11 = this.heightData[cellX + 1 + (cellZ + 1) * this.heightFieldWidth];

    if (fx + fz <= 1) {
      return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    }

    const invFx = 1 - fx;
    const invFz = 1 - fz;
    return h11 + (h01 - h11) * invFx + (h10 - h11) * invFz;
  }

  private loadSimplexNoiseTexture(): void {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.src = "/simplex-noise.png";
    image.onload = () => {
      if (this.disposed) {
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const grayscale = new Float32Array(image.width * image.height);

      for (let i = 0; i < grayscale.length; i += 1) {
        const pixelIndex = i * 4;
        const red = pixels[pixelIndex];
        const green = pixels[pixelIndex + 1];
        const blue = pixels[pixelIndex + 2];
        grayscale[i] = (red + green + blue) / (3 * 255);
      }

      this.simplexNoiseData = grayscale;
      this.simplexNoiseWidth = image.width;
      this.simplexNoiseHeight = image.height;
      this.rebuildTerrainData();
    };
  }

  private rebuildTerrainData(): void {
    const { data, width, depth } = this.buildHeightData();
    this.heightData = data;
    this.heightFieldWidth = width;
    this.heightFieldDepth = depth;

    this.applyHeightsToGeometry(this.geometry, data);
    const textureCanvas = this.generateTerrainTexture(data, width, depth);
    this.texture.image = textureCanvas;
    this.texture.needsUpdate = true;
  }

  private sampleSimplexNoise(worldX: number, worldZ: number, frequency: number): number {
    if (
      !this.simplexNoiseData ||
      this.simplexNoiseWidth <= 1 ||
      this.simplexNoiseHeight <= 1
    ) {
      return this.grainAtPixel(worldX * frequency * 1000, worldZ * frequency * 1000);
    }

    const u = this.fract(worldX * frequency + this.seed * 0.0131);
    const v = this.fract(worldZ * frequency - this.seed * 0.0097);

    const x = u * (this.simplexNoiseWidth - 1);
    const y = v * (this.simplexNoiseHeight - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = (x0 + 1) % this.simplexNoiseWidth;
    const y1 = (y0 + 1) % this.simplexNoiseHeight;
    const tx = x - x0;
    const ty = y - y0;

    const d = this.simplexNoiseData;
    const w = this.simplexNoiseWidth;
    const n00 = d[x0 + y0 * w];
    const n10 = d[x1 + y0 * w];
    const n01 = d[x0 + y1 * w];
    const n11 = d[x1 + y1 * w];
    const nx0 = MathUtils.lerp(n00, n10, tx);
    const nx1 = MathUtils.lerp(n01, n11, tx);
    return MathUtils.lerp(nx0, nx1, ty);
  }

  private fract(value: number): number {
    return value - Math.floor(value);
  }

  private getTrackProximity(worldX: number, worldZ: number): TrackProximity {
    const sampleCount = this.trackSamples.length / 3;
    if (sampleCount === 0) {
      return { distance: Number.POSITIVE_INFINITY, trackHeight: 0 };
    }
    if (sampleCount === 1) {
      const dx = worldX - this.trackSamples[0];
      const dz = worldZ - this.trackSamples[2];
      return {
        distance: Math.sqrt(dx * dx + dz * dz),
        trackHeight: this.trackSamples[1]
      };
    }

    let minDistanceSq = Number.POSITIVE_INFINITY;
    let nearestTrackHeight = 0;
    const closed = this.spline.isClosed();
    const segmentCount = closed ? sampleCount : sampleCount - 1;

    for (let i = 0; i < segmentCount; i += 1) {
      const currentIndex = i * 3;
      const nextIndex = (closed ? (i + 1) % sampleCount : i + 1) * 3;
      const ax = this.trackSamples[currentIndex];
      const ay = this.trackSamples[currentIndex + 1];
      const az = this.trackSamples[currentIndex + 2];
      const bx = this.trackSamples[nextIndex];
      const by = this.trackSamples[nextIndex + 1];
      const bz = this.trackSamples[nextIndex + 2];

      const result = this.closestPointOnSegmentXZ(worldX, worldZ, ax, az, bx, bz);
      if (result.distanceSq < minDistanceSq) {
        minDistanceSq = result.distanceSq;
        nearestTrackHeight = MathUtils.lerp(ay, by, result.t);
      }
    }

    return {
      distance: Math.sqrt(minDistanceSq),
      trackHeight: nearestTrackHeight
    };
  }

  private closestPointOnSegmentXZ(
    px: number,
    pz: number,
    ax: number,
    az: number,
    bx: number,
    bz: number
  ): { distanceSq: number; t: number } {
    const abx = bx - ax;
    const abz = bz - az;
    const apx = px - ax;
    const apz = pz - az;
    const abLengthSq = abx * abx + abz * abz;
    if (abLengthSq <= 1e-6) {
      return { distanceSq: apx * apx + apz * apz, t: 0 };
    }

    const t = MathUtils.clamp((apx * abx + apz * abz) / abLengthSq, 0, 1);
    const closestX = ax + abx * t;
    const closestZ = az + abz * t;
    const dx = px - closestX;
    const dz = pz - closestZ;
    return { distanceSq: dx * dx + dz * dz, t };
  }

  private generateTerrainTexture(
    data: Float32Array,
    width: number,
    depth: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = depth;

    const context = canvas.getContext('2d');
    if (!context) {
      return canvas;
    }

    const image = context.getImageData(0, 0, width, depth);
    const imageData = image.data;
    const slopeNormal = new Vector3();

    const lowColor = new Color('#4f6b3f');
    const midColor = new Color('#7e8f62');
    const highColor = new Color('#a9a888');
    const rockColor = new Color('#8b8470');
    const snowColor = new Color('#f4f5f8');
    const color = new Color();

    for (let z = 0; z < depth; z += 1) {
      const worldZ = MathUtils.lerp(-this.worldHalfSize, this.worldHalfSize, z / (depth - 1));
      for (let x = 0; x < width; x += 1) {
        const worldX = MathUtils.lerp(-this.worldHalfSize, this.worldHalfSize, x / (width - 1));
        const index = x + z * width;
        const pixelIndex = index * 4;
        const left = data[Math.max(0, x - 1) + z * width];
        const right = data[Math.min(width - 1, x + 1) + z * width];
        const up = data[x + Math.max(0, z - 1) * width];
        const down = data[x + Math.min(depth - 1, z + 1) * width];

        slopeNormal.set(left - right, 2, up - down).normalize();
        const slope = 1 - MathUtils.clamp(Math.abs(slopeNormal.y), 0, 1);
        const largeNoise = this.sampleSimplexNoise(worldX, worldZ, 0.0045);
        const fineNoise = this.sampleSimplexNoise(worldX + 120, worldZ - 90, 0.03);

        const elevation = MathUtils.clamp(data[index] / this.config.maxHeight, 0, 1.25);
        if (elevation < 0.45) {
          color.lerpColors(lowColor, midColor, elevation / 0.45);
        } else {
          color.lerpColors(midColor, highColor, (elevation - 0.45) / 0.8);
        }

        const rockMask = MathUtils.smoothstep(slope, 0.18, 0.68) * MathUtils.smoothstep(elevation, 0.08, 1.0);
        color.lerp(rockColor, rockMask * 0.92);

        const snowThreshold = 0.82 - largeNoise * 0.12;
        const snowMask = MathUtils.smoothstep(elevation, snowThreshold, 1.12);
        color.lerp(snowColor, snowMask * (0.35 + slope * 0.65));

        const lightness = MathUtils.lerp(0.74, 1.06, 1 - slope * 0.55);
        const grain = (fineNoise - 0.5) * 0.14 + (this.grainAtPixel(x, z) - 0.5) * 0.04;
        color.multiplyScalar(lightness + grain);

        imageData[pixelIndex] = MathUtils.clamp(color.r * 255, 0, 255);
        imageData[pixelIndex + 1] = MathUtils.clamp(color.g * 255, 0, 255);
        imageData[pixelIndex + 2] = MathUtils.clamp(color.b * 255, 0, 255);
        imageData[pixelIndex + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);

    const scaled = document.createElement('canvas');
    scaled.width = width * 4;
    scaled.height = depth * 4;
    const scaledContext = scaled.getContext('2d');
    if (!scaledContext) {
      return canvas;
    }

    scaledContext.scale(4, 4);
    scaledContext.drawImage(canvas, 0, 0);

    const scaledImage = scaledContext.getImageData(0, 0, scaled.width, scaled.height);
    const scaledData = scaledImage.data;
    for (let i = 0; i < scaledData.length; i += 4) {
      const noise = (this.grainAtPixel(i * 0.25, i * 0.13) - 0.5) * 8;
      scaledData[i] = MathUtils.clamp(scaledData[i] + noise, 0, 255);
      scaledData[i + 1] = MathUtils.clamp(scaledData[i + 1] + noise, 0, 255);
      scaledData[i + 2] = MathUtils.clamp(scaledData[i + 2] + noise, 0, 255);
    }
    scaledContext.putImageData(scaledImage, 0, 0);

    return scaled;
  }

  private grainAtPixel(x: number, y: number): number {
    const value = Math.sin((x + this.seed * 0.37) * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }
}
