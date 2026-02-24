import { MathUtils, Object3D, PerspectiveCamera, Quaternion, SpotLight, Vector3 } from "three";
import { TrackSpline } from "../world/Track/TrackSpline";

export type CameraRigConfig = {
  fov: number;
  near: number;
  far: number;
  lookAheadDistance: number;
  eyeHeight: number;
  eyeBackOffset: number;
  swayFrequency: number;
  swayAmplitude: number;
};

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly headlight: SpotLight;
  readonly headlightTarget: Object3D;
  private elapsedTime = 0;
  private debugLookEnabled = false;
  private debugYaw = 0;
  private debugPitch = 0;
  private readonly debugForward = new Vector3();
  private readonly debugRight = new Vector3();
  private readonly debugLookTarget = new Vector3();
  private readonly debugYawRotation = new Quaternion();
  private readonly debugPitchRotation = new Quaternion();
  private readonly worldUp = new Vector3(0, 1, 0);

  private static readonly DEBUG_LOOK_SENSITIVITY = 0.0025;
  private static readonly DEBUG_LOOK_MAX_PITCH = Math.PI * 0.46;

  constructor(
    private readonly spline: TrackSpline,
    private readonly config: CameraRigConfig,
    aspect: number,
  ) {
    this.camera = new PerspectiveCamera(
      config.fov,
      aspect,
      config.near,
      config.far,
    );

    this.headlight = new SpotLight(
      "#ffe8c4",
      0,
      220,
      Math.PI * 0.16,
      0.36,
      1.6,
    );
    this.headlightTarget = new Object3D();
    this.headlight.castShadow = true;
    this.headlight.shadow.mapSize.set(512, 512);
    this.headlight.shadow.bias = -0.0002;
    this.headlight.shadow.normalBias = 0.018;
    this.headlight.shadow.camera.near = 0.8;
    this.headlight.shadow.camera.far = 240;
    this.headlight.visible = false;
    this.headlight.target = this.headlightTarget;
  }

  update(distance: number, speed: number, dt: number): void {
    this.elapsedTime += dt;

    const position = this.spline.getPositionAtDistance(distance);
    const tangent = this.spline.getTangentAtDistance(distance);
    const right = new Vector3()
      .crossVectors(tangent, new Vector3(0, 1, 0))
      .normalize();
    const backOffset = this.spline.isClosed()
      ? this.config.eyeBackOffset
      : Math.min(this.config.eyeBackOffset, Math.max(0, distance));

    const sway =
      Math.sin(this.elapsedTime * this.config.swayFrequency) *
      this.config.swayAmplitude *
      Math.min(speed / 30, 1);

    const eyePosition = position
      .clone()
      .addScaledVector(tangent, -backOffset)
      .addScaledVector(right, sway);

    eyePosition.y += this.config.eyeHeight;

    const lookAt = this.spline
      .getPositionAtDistance(distance + this.config.lookAheadDistance)
      .addScaledVector(right, sway * 0.35);

    lookAt.y += this.config.eyeHeight * 0.7;

    this.camera.position.copy(eyePosition);

    // Update headlight using true train position and orientation (no sway, no debug look)
    const trainFront = position.clone();
    trainFront.y += 1.1; // Headlight height
    this.headlight.position.copy(trainFront);
    this.headlightTarget.position.copy(trainFront).addScaledVector(tangent, 54);
    this.headlightTarget.position.y -= 1.4; // Point slightly down
    this.headlightTarget.updateMatrixWorld();

    if (!this.debugLookEnabled) {
      this.camera.lookAt(lookAt);
      return;
    }

    this.debugForward.copy(lookAt).sub(eyePosition).normalize();
    this.debugYawRotation.setFromAxisAngle(this.worldUp, this.debugYaw);
    this.debugForward.applyQuaternion(this.debugYawRotation).normalize();

    this.debugRight.crossVectors(this.debugForward, this.worldUp);
    if (this.debugRight.lengthSq() < 1e-6) {
      this.debugRight.set(1, 0, 0);
    } else {
      this.debugRight.normalize();
    }

    this.debugPitchRotation.setFromAxisAngle(this.debugRight, this.debugPitch);
    this.debugForward.applyQuaternion(this.debugPitchRotation).normalize();
    this.debugLookTarget
      .copy(eyePosition)
      .addScaledVector(this.debugForward, this.config.lookAheadDistance);
    this.camera.lookAt(this.debugLookTarget);
  }

  setHeadlightIntensity(lightFactor: number): void {
    this.headlight.intensity = 120 * lightFactor;
    this.headlight.distance = MathUtils.lerp(80, 220, lightFactor);
    this.headlight.castShadow = lightFactor > 0.22;
    this.headlight.visible = lightFactor > 0.01;
  }

  isDebugLookEnabled(): boolean {
    return this.debugLookEnabled;
  }

  setDebugLookEnabled(enabled: boolean): void {
    this.debugLookEnabled = enabled;
    if (!enabled) {
      this.debugYaw = 0;
      this.debugPitch = 0;
    }
  }

  addDebugLookDelta(deltaX: number, deltaY: number): void {
    if (!this.debugLookEnabled) {
      return;
    }

    this.debugYaw -= deltaX * CameraRig.DEBUG_LOOK_SENSITIVITY;
    this.debugPitch = MathUtils.clamp(
      this.debugPitch - deltaY * CameraRig.DEBUG_LOOK_SENSITIVITY,
      -CameraRig.DEBUG_LOOK_MAX_PITCH,
      CameraRig.DEBUG_LOOK_MAX_PITCH,
    );
  }

  reset(): void {
    this.elapsedTime = 0;
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
