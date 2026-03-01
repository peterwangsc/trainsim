import {
  Color,
  DynamicDrawUsage,
  Frustum,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Sphere,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import {
  spriteCloudFogVertex,
  spriteCloudFragmentBase,
  spriteCloudOpaqueFragment,
  spriteCloudOutputFragment,
  spriteCloudVertexBase,
} from "./shaders/dayNightSkyShader";
import type { CONFIG } from "../../game/Config";

export type TerrainHeightSampler = (worldX: number, worldZ: number) => number;

type SpriteCloudInstance = {
  matrix: Matrix4;
  position: Vector3;
  baseAltitude: number;
  driftDirection: Vector3;
  driftSpeed: number;
  rotation: number;
  rotationFactor: number;
  volume: number;
  growth: number;
  density: number;
  opacity: number;
  brightness: number;
  dist: number;
};

export class CloudLayer {
  public readonly mesh: InstancedMesh<PlaneGeometry, MeshLambertMaterial>;
  private readonly material: MeshLambertMaterial;
  private readonly texture: Texture;
  private readonly opacities: Float32Array;
  private readonly opacityAttribute: InstancedBufferAttribute;
  private readonly instances: SpriteCloudInstance[];

  private readonly cloudColor = new Color();
  private readonly cloudInstanceColor = new Color();
  private readonly cloudBillboardQuaternion = new Quaternion();
  private readonly cloudSpinQuaternion = new Quaternion();
  private readonly cloudScale = new Vector3();
  private readonly cloudForward = new Vector3(0, 0, 1);
  private readonly cloudFrustum = new Frustum();
  private readonly cloudFrustumMatrix = new Matrix4();
  private readonly cloudCullSphere = new Sphere();
  private readonly visibleClouds: SpriteCloudInstance[] = [];

  private terrainHeightSampler: TerrainHeightSampler | null = null;

  constructor(
    private readonly config: typeof CONFIG,
    preloadedTexture: Texture,
  ) {
    this.texture = preloadedTexture;
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;

    const { cloud } = this.config.sky;
    const geometry = new PlaneGeometry(1, 1);
    this.opacities = new Float32Array(cloud.spriteLimit);
    this.opacities.fill(1);
    this.opacityAttribute = new InstancedBufferAttribute(this.opacities, 1);
    this.opacityAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("cloudOpacity", this.opacityAttribute);

    this.material = new MeshLambertMaterial({
      map: this.texture,
      color: "#ffffff",
      emissive: "#ffffff",
      emissiveIntensity: cloud.emissiveIntensityDay,
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        spriteCloudVertexBase() +
        shader.vertexShader.replace(
          "#include <fog_vertex>",
          spriteCloudFogVertex(),
        );

      let fragmentShader = shader.fragmentShader;
      fragmentShader = spriteCloudFragmentBase() + fragmentShader;

      if (fragmentShader.includes("#include <opaque_fragment>")) {
        fragmentShader = fragmentShader.replace(
          "#include <opaque_fragment>",
          spriteCloudOpaqueFragment(),
        );
      } else if (fragmentShader.includes("#include <output_fragment>")) {
        fragmentShader = fragmentShader.replace(
          "#include <output_fragment>",
          spriteCloudOutputFragment(),
        );
      }

      shader.fragmentShader = fragmentShader;
    };
    this.material.needsUpdate = true;

    this.mesh = new InstancedMesh(geometry, this.material, cloud.spriteLimit);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const colors = new Float32Array(cloud.spriteLimit * 3);
    colors.fill(1);
    this.mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);

    this.instances = [];
    const initialQuaternion = new Quaternion();
    const initialScale = new Vector3();
    const initialColor = new Color("#ffffff");

    for (let index = 0; index < cloud.spriteLimit; index += 1) {
      const driftAngle = Math.random() * Math.PI * 2;
      const initialX = this.randomRange(
        -cloud.worldHalfExtent,
        cloud.worldHalfExtent,
      );
      const initialZ = this.randomRange(
        -cloud.worldHalfExtent,
        cloud.worldHalfExtent,
      );
      const baseAltitude =
        cloud.altitudeMin + Math.random() * cloud.altitudeVariation;
      const instance = {
        matrix: new Matrix4(),
        position: new Vector3(
          initialX,
          this.clampCloudAltitudeToTerrain(initialX, initialZ, baseAltitude),
          initialZ,
        ),
        baseAltitude,
        driftDirection: new Vector3(
          Math.cos(driftAngle),
          0,
          Math.sin(driftAngle),
        ),
        driftSpeed: this.randomRange(cloud.driftSpeedMin, cloud.driftSpeedMax),
        rotation: Math.random() * Math.PI * 2,
        rotationFactor: this.randomRange(
          cloud.rotationFactorMin,
          cloud.rotationFactorMax,
        ),
        volume: this.randomRange(cloud.volumeMin, cloud.volumeMax),
        growth: this.randomRange(cloud.growthMin, cloud.growthMax),
        density: this.randomRange(cloud.densityMin, cloud.densityMax),
        opacity: this.randomRange(cloud.opacityMin, cloud.opacityMax),
        brightness: this.randomRange(cloud.brightnessMin, cloud.brightnessMax),
        dist: 0,
      } satisfies SpriteCloudInstance;

      initialScale.setScalar(instance.volume);
      instance.matrix.compose(
        instance.position,
        initialQuaternion,
        initialScale,
      );
      this.instances.push(instance);
      this.opacities[index] = instance.opacity;
      this.mesh.setMatrixAt(index, instance.matrix);
      this.mesh.setColorAt(index, initialColor);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
    this.opacityAttribute.needsUpdate = true;
  }

  setTerrainHeightSampler(sampler: TerrainHeightSampler | null): void {
    this.terrainHeightSampler = sampler;
    if (!sampler) {
      return;
    }

    for (const cloud of this.instances) {
      cloud.position.y = this.clampCloudAltitudeToTerrain(
        cloud.position.x,
        cloud.position.z,
        cloud.baseAltitude,
      );
    }
  }

  update(
    dt: number,
    camera: PerspectiveCamera,
    elapsedSeconds: number,
    cloudDayColor: Color,
    cloudTwilightColor: Color,
    cloudNightColor: Color,
    dayFactor: number,
    twilightFactor: number,
    nightFactor: number,
  ): void {
    const { cloud: cloudConfig } = this.config.sky;
    const visibleClouds = this.visibleClouds;
    visibleClouds.length = 0;

    this.cloudColor.lerpColors(cloudDayColor, cloudNightColor, nightFactor);
    this.cloudColor.lerp(cloudTwilightColor, twilightFactor * 0.5);
    this.material.emissive.copy(this.cloudColor);
    this.material.emissiveIntensity = MathUtils.lerp(
      cloudConfig.emissiveIntensityDay,
      cloudConfig.emissiveIntensityNight,
      nightFactor,
    );

    camera.updateMatrixWorld();
    this.cloudFrustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.cloudFrustum.setFromProjectionMatrix(this.cloudFrustumMatrix);
    this.cloudBillboardQuaternion.copy(camera.quaternion);

    for (let index = 0; index < this.instances.length; index += 1) {
      const cloud = this.instances[index];
      cloud.rotation += dt * cloud.rotationFactor;

      cloud.position.x = this.wrapCloudCoordinate(
        cloud.position.x + cloud.driftDirection.x * cloud.driftSpeed * dt,
      );
      cloud.position.z = this.wrapCloudCoordinate(
        cloud.position.z + cloud.driftDirection.z * cloud.driftSpeed * dt,
      );
      cloud.position.y = this.clampCloudAltitudeToTerrain(
        cloud.position.x,
        cloud.position.z,
        cloud.baseAltitude,
      );

      const cloudVolume =
        cloud.volume +
        (1 + Math.sin(elapsedSeconds * cloud.density)) * 0.5 * cloud.growth;
      this.cloudScale.setScalar(cloudVolume);
      this.cloudSpinQuaternion
        .setFromAxisAngle(this.cloudForward, cloud.rotation)
        .premultiply(this.cloudBillboardQuaternion);
      cloud.matrix.compose(
        cloud.position,
        this.cloudSpinQuaternion,
        this.cloudScale,
      );
      cloud.dist = camera.position.distanceTo(cloud.position);
      this.cloudCullSphere.center.copy(cloud.position);
      this.cloudCullSphere.radius = cloudVolume * cloudConfig.cullRadiusFactor;
      if (!this.cloudFrustum.intersectsSphere(this.cloudCullSphere)) {
        continue;
      }

      visibleClouds.push(cloud);
    }

    visibleClouds.sort((a, b) => b.dist - a.dist);
    const dayVisibility = MathUtils.lerp(0.48, 0.92, dayFactor);
    const nightVisibility = MathUtils.lerp(1, 0.62, nightFactor);
    this.mesh.count = visibleClouds.length;

    for (let index = 0; index < visibleClouds.length; index += 1) {
      const cloud = visibleClouds[index];
      const edgeFade = this.computeCloudEdgeFade(cloud.dist);
      this.opacities[index] =
        cloud.opacity * edgeFade * dayVisibility * nightVisibility;
      this.mesh.setMatrixAt(index, cloud.matrix);
      this.cloudInstanceColor
        .copy(this.cloudColor)
        .multiplyScalar(cloud.brightness + twilightFactor * 0.06);
      this.mesh.setColorAt(index, this.cloudInstanceColor);
    }

    this.opacityAttribute.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private randomRange(min: number, max: number): number {
    return min + (max - min) * Math.random();
  }

  private computeCloudEdgeFade(distance: number): number {
    const fadeRadius = this.config.sky.cloud.fadeRadius;
    return 1 - MathUtils.smoothstep(fadeRadius * 0.72, fadeRadius, distance);
  }

  private wrapCloudCoordinate(value: number): number {
    const halfExtent = this.config.sky.cloud.worldHalfExtent;
    const wrapPadding = this.config.sky.cloud.worldWrapPadding;
    if (value < -halfExtent) {
      return halfExtent - this.randomRange(0, wrapPadding);
    }
    if (value > halfExtent) {
      return -halfExtent + this.randomRange(0, wrapPadding);
    }

    return value;
  }

  private clampCloudAltitudeToTerrain(
    worldX: number,
    worldZ: number,
    worldAltitude: number,
  ): number {
    if (!this.terrainHeightSampler) {
      return worldAltitude;
    }

    const terrainHeight = this.terrainHeightSampler(worldX, worldZ);
    const minWorldAltitude =
      terrainHeight + this.config.sky.cloud.terrainClearance;

    return Math.max(worldAltitude, minWorldAltitude);
  }
}
