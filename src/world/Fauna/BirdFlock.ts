import {
  BufferAttribute,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
  type IUniform
} from 'three';
import { stepBoidsCPU } from './boidStep';
import { birdFragment, birdVertex } from './shaders/birdFlockShader';

type BirdState = {
  pos: Vector3;
  vel: Vector3;
};

export type BirdFlockConfig = {
  count: number;
  bounds: number;
  anchorDistance: number;
  anchorHeight: number;
  anchorSmoothing: number;
  minSpeed: number;
  maxSpeed: number;
};

const DEFAULT_BIRD_FLOCK_CONFIG: BirdFlockConfig = {
  count: 160,
  bounds: 52,
  anchorDistance: 86,
  anchorHeight: 46,
  anchorSmoothing: 2.4,
  minSpeed: 1.2,
  maxSpeed: 3.8
};

const ALTITUDE_MIN_FACTOR = -0.18;
const ALTITUDE_MAX_FACTOR = 0.2;
const CONFINEMENT_RADIUS_FACTOR = 0.5;

const tempObject = new Object3D();
const forward = new Vector3();
const up = new Vector3(0, 1, 0);
const orientation = new Quaternion();
const toCenter = new Vector3();

function hash01(seed: number): number {
  const hashed = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return hashed - Math.floor(hashed);
}

function createBirdStates(
  count: number,
  bounds: number,
  minSpeed: number,
  maxSpeed: number
): BirdState[] {
  const birds: BirdState[] = [];

  for (let i = 0; i < count; i += 1) {
    const seed = i * 19.371;
    const pos = new Vector3(
      (hash01(seed + 0.11) - 0.5) * bounds,
      hash01(seed + 0.57) * bounds * 0.5 + 4,
      (hash01(seed + 1.03) - 0.5) * bounds
    );
    const vel = new Vector3(
      (hash01(seed + 1.71) - 0.5) * 2,
      (hash01(seed + 2.29) - 0.5) * 0.5,
      (hash01(seed + 2.83) - 0.5) * 2
    );

    if (vel.lengthSq() < 1e-6) {
      vel.set(0, 1, 0);
    }

    vel
      .normalize()
      .multiplyScalar(minSpeed + hash01(seed + 3.47) * (maxSpeed - minSpeed));

    birds.push({ pos, vel });
  }

  return birds;
}

function createBirdGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  const vertices = new Float32Array([
    0.0, 0.08, 0.0, -0.015, 0.0, 0.0, 0.015, 0.0, 0.0,
    -0.01, 0.02, 0.0, -0.2, -0.04, 0.0, -0.03, -0.01, 0.0,
    0.01, 0.02, 0.0, 0.2, -0.04, 0.0, 0.03, -0.01, 0.0
  ]);
  geometry.setAttribute('position', new BufferAttribute(vertices, 3));
  return geometry;
}

function createBirdMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 }
    },
    vertexShader: birdVertex(),
    fragmentShader: birdFragment(),
    side: DoubleSide,
    transparent: true,
    depthWrite: false
  });
}

function attachInstanceAttributes(
  geometry: InstancedBufferGeometry,
  count: number
): void {
  const phase = new Float32Array(count);
  const flapSpeed = new Float32Array(count);
  const birdScale = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const seed = i * 7.913;
    phase[i] = hash01(seed + 0.13) * Math.PI * 2;
    flapSpeed[i] = 6 + hash01(seed + 0.71) * 6;
    birdScale[i] = 0.7 + hash01(seed + 1.19) * 0.8;
  }

  geometry.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
  geometry.setAttribute('aFlapSpeed', new InstancedBufferAttribute(flapSpeed, 1));
  geometry.setAttribute('aBirdScale', new InstancedBufferAttribute(birdScale, 1));
}

export class BirdFlock {
  private readonly root = new Group();
  private readonly geometry: InstancedBufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly mesh: InstancedMesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly birds: BirdState[];
  private readonly config: BirdFlockConfig;
  private readonly anchor = new Vector3();
  private readonly targetAnchor = new Vector3();
  private readonly cameraForward = new Vector3();

  private anchorInitialized = false;
  private elapsedTime = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    config: Partial<BirdFlockConfig> = {}
  ) {
    this.config = { ...DEFAULT_BIRD_FLOCK_CONFIG, ...config };
    this.birds = createBirdStates(
      this.config.count,
      this.config.bounds,
      this.config.minSpeed,
      this.config.maxSpeed
    );
    this.geometry = createBirdGeometry();
    attachInstanceAttributes(this.geometry, this.config.count);
    this.material = createBirdMaterial();
    this.mesh = new InstancedMesh(this.geometry, this.material, this.config.count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    this.root.name = 'bird-flock';
    this.root.frustumCulled = false;
    this.root.add(this.mesh);
    this.scene.add(this.root);

    this.updateInstanceMatrices();
  }

  update(dt: number, camera: PerspectiveCamera, nightFactor: number): void {
    if (this.disposed) {
      return;
    }

    const clampedDt = Math.min(dt, 1 / 20);
    if (clampedDt <= 0) {
      return;
    }

    this.elapsedTime += clampedDt;
    const timeUniform = this.material.uniforms.uTime as IUniform<number> | undefined;
    if (timeUniform) {
      timeUniform.value = this.elapsedTime;
    }

    const opacityUniform = this.material.uniforms.uOpacity as IUniform<number> | undefined;
    if (opacityUniform) {
      opacityUniform.value = MathUtils.lerp(1, 0.68, nightFactor);
    }

    camera.getWorldDirection(this.cameraForward);
    this.targetAnchor
      .copy(camera.position)
      .addScaledVector(this.cameraForward, this.config.anchorDistance);
    this.targetAnchor.y += this.config.anchorHeight;

    if (!this.anchorInitialized) {
      this.anchor.copy(this.targetAnchor);
      this.anchorInitialized = true;
    } else {
      this.anchor.x = MathUtils.damp(
        this.anchor.x,
        this.targetAnchor.x,
        this.config.anchorSmoothing,
        clampedDt
      );
      this.anchor.y = MathUtils.damp(
        this.anchor.y,
        this.targetAnchor.y,
        this.config.anchorSmoothing,
        clampedDt
      );
      this.anchor.z = MathUtils.damp(
        this.anchor.z,
        this.targetAnchor.z,
        this.config.anchorSmoothing,
        clampedDt
      );
    }
    this.root.position.copy(this.anchor);

    stepBoidsCPU(this.birds, clampedDt, {
      neighborRadius: 4.2,
      separationRadius: 1.35,
      separationWeight: 1.18,
      alignmentWeight: 0.54,
      cohesionWeight: 0.38,
      minSpeed: this.config.minSpeed,
      maxSpeed: this.config.maxSpeed
    });

    const confinementRadius = this.config.bounds * CONFINEMENT_RADIUS_FACTOR;
    const confinementRadiusSq = confinementRadius * confinementRadius;
    const minAltitude = this.config.bounds * ALTITUDE_MIN_FACTOR;
    const maxAltitude = this.config.bounds * ALTITUDE_MAX_FACTOR;

    for (const bird of this.birds) {
      const horizontalDistSq = bird.pos.x * bird.pos.x + bird.pos.z * bird.pos.z;
      if (horizontalDistSq > confinementRadiusSq) {
        const horizontalDist = Math.sqrt(horizontalDistSq);
        const overflow = horizontalDist - confinementRadius;
        const invDist = 1 / Math.max(horizontalDist, 1e-6);
        toCenter.set(-bird.pos.x * invDist, 0, -bird.pos.z * invDist);
        bird.vel.addScaledVector(toCenter, overflow * 1.6 * clampedDt);
        bird.pos.addScaledVector(toCenter, overflow * 0.12);
      }

      if (bird.pos.y < minAltitude) {
        bird.vel.y += (minAltitude - bird.pos.y) * 1.35 * clampedDt;
      } else if (bird.pos.y > maxAltitude) {
        bird.vel.y += (maxAltitude - bird.pos.y) * 1.35 * clampedDt;
      }

      const speed = bird.vel.length();
      if (speed > this.config.maxSpeed) {
        bird.vel.setLength(this.config.maxSpeed);
      } else if (speed < this.config.minSpeed) {
        bird.vel.setLength(this.config.minSpeed);
      }
    }

    this.updateInstanceMatrices();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.scene.remove(this.root);
    this.geometry.dispose();
    this.material.dispose();
  }

  private updateInstanceMatrices(): void {
    for (let i = 0; i < this.birds.length; i += 1) {
      const bird = this.birds[i];
      const speed = bird.vel.length();

      forward.copy(bird.vel);
      if (forward.lengthSq() <= 1e-8) {
        forward.set(0, 1, 0);
      } else {
        forward.normalize();
      }

      orientation.setFromUnitVectors(up, forward);
      tempObject.position.copy(bird.pos);
      tempObject.quaternion.copy(orientation);
      const stretch = MathUtils.mapLinear(
        speed,
        this.config.minSpeed,
        this.config.maxSpeed,
        0.9,
        1.12
      );
      tempObject.scale.setScalar(stretch);
      tempObject.updateMatrix();
      this.mesh.setMatrixAt(i, tempObject.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
