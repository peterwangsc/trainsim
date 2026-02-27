import {
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Scene,
  SpotLight,
  Vector3,
} from "three";

export class TrainHeadlight {
  public readonly light: SpotLight;
  public readonly target: Object3D;
  public isEnabled = false;

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
  ) {
    this.light = new SpotLight("#ffe8c4", 0, 220, Math.PI * 0.16, 0.36, 1.6);
    this.target = new Object3D();
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.bias = -0.0002;
    this.light.shadow.normalBias = 0.018;
    this.light.shadow.camera.near = 0.8;
    this.light.shadow.camera.far = 240;
    this.light.visible = false;
    this.light.target = this.target;

    this.scene.add(this.light);
    this.scene.add(this.target);
  }

  update(nightFactor: number): void {
    if (!this.isEnabled || nightFactor === 0) {
      this.light.intensity = 0;
      this.target.updateMatrixWorld();
      return;
    }

    const lightFactor = MathUtils.smoothstep(1 - nightFactor, -0.39, 0.28);
    this.light.intensity = 720 * lightFactor;
    this.light.distance = MathUtils.lerp(80, 220, lightFactor);
    this.light.castShadow = lightFactor > 0.22;
    this.light.visible = lightFactor > 0.01;

    const trainFront = this.camera.position.clone();
    const tangent = new Vector3();
    this.camera.getWorldDirection(tangent);
    trainFront.y += 1.1; // Headlight height
    this.light.position.copy(trainFront);
    this.target.position.copy(trainFront).addScaledVector(tangent, 54);
    this.target.position.y -= 1.4; // Point slightly down
    this.target.updateMatrixWorld();
  }

  dispose(): void {
    this.scene.remove(this.light);
    this.scene.remove(this.target);
  }
}
