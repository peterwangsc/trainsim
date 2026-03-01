import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { TrackSpline } from "@/world/Track/TrackSpline";
import { curvatureAtDistance } from "@/world/Track/Curvature";

export type CameraRigConfig = {
  fov: number;
  near: number;
  far: number;
  lookAheadDistance: number;
  eyeHeight: number;
  eyeBackOffset: number;
  swayFrequency: number;
  swayAmplitude: number;
  // camera dynamics
  maxSpeed: number;
  rollFactor: number;
  rollSpringK: number;
  pitchFactor: number;
  pitchSpringK: number;
  vibrationAmplitude: number;
  vibrationFreqHigh: number;
  fovBoost: number;
  brakeShudderAmplitude: number;
  brakeShudderDecay: number;
};

export class CameraRig {
  readonly camera: PerspectiveCamera;
  private elapsedTime = 0;
  private spline!: TrackSpline;

  // spring state
  private currentRoll = 0;
  private currentPitch = 0;

  // brake shudder
  private brakeShudder = 0;
  private prevBrakeActive = false;

  constructor(
    spline: TrackSpline,
    private readonly config: CameraRigConfig,
    aspect: number,
  ) {
    this.spline = spline;
    this.camera = new PerspectiveCamera(
      config.fov,
      aspect,
      config.near,
      config.far,
    );
  }

  updateSpline(spline: TrackSpline): void {
    this.spline = spline;
    this.elapsedTime = 0;
  }

  dispose(): void {}

  update(
    distance: number,
    speed: number,
    acceleration: number,
    brakeActive: boolean,
    dt: number,
  ): void {
    this.elapsedTime += dt;
    const t = this.elapsedTime;

    // --- Base track-following ---
    const position = this.spline.getPositionAtDistance(distance);
    const tangent = this.spline.getTangentAtDistance(distance);
    const right = new Vector3()
      .crossVectors(tangent, new Vector3(0, 1, 0))
      .normalize();
    const backOffset = this.spline.isClosed()
      ? this.config.eyeBackOffset
      : Math.min(this.config.eyeBackOffset, Math.max(0, distance));
    // 0→1 as speed approaches maxSpeed
    const speedFactor = Math.min(speed / this.config.maxSpeed, 1);

    // --- Low-freq lateral sway (existing behaviour) ---
    const sway =
      Math.sin(t * this.config.swayFrequency) *
      this.config.swayAmplitude *
      Math.min(speed / 30, 1);

    // --- High-freq track vibration, scales with speed ---
    const curvature = curvatureAtDistance(this.spline, distance);
    const vibAmp =
      this.config.vibrationAmplitude * speedFactor * Math.abs(curvature * 1.5);
    const hf = this.config.vibrationFreqHigh * Math.PI * 2;
    const vibLat =
      (Math.sin(t * hf) * 0.5 +
        Math.sin(t * hf * 1.37 + 0.8) * 0.3 +
        Math.sin(t * hf * 2.1 + 2.1) * 0.2) *
      vibAmp;
    const vibVert =
      (Math.sin(t * hf * 0.9 + 1.1) * 0.5 +
        Math.sin(t * hf * 1.6 + 0.5) * 0.3 +
        Math.sin(t * hf * 2.4 + 3.0) * 0.2) *
      vibAmp;

    // --- Brake shudder: fires on brake onset, decays exponentially ---
    if (brakeActive && !this.prevBrakeActive) {
      this.brakeShudder = this.config.brakeShudderAmplitude;
    }
    this.prevBrakeActive = brakeActive;
    this.brakeShudder *= Math.exp(-this.config.brakeShudderDecay * dt);
    const shudder =
      this.brakeShudder * Math.sin(t * 25 * Math.PI * 2) * speedFactor * 1.4;

    // --- Compose eye position ---
    const eyePosition = position
      .clone()
      .addScaledVector(tangent, -backOffset)
      .addScaledVector(right, sway + vibLat);
    eyePosition.y += this.config.eyeHeight + vibVert + shudder;

    // --- Look-at point ---
    const lookAt = this.spline
      .getPositionAtDistance(distance + this.config.lookAheadDistance)
      .addScaledVector(right, sway * 0.35);
    lookAt.y += this.config.eyeHeight * 0.7;

    // Apply base orientation
    this.camera.position.copy(eyePosition);
    this.camera.lookAt(lookAt);

    // --- Curvature roll (spring toward target, applied in camera-local space) ---
    // Negative sign: left curve (positive curvature) throws body right → top tilts right
    const rollTarget = -curvature * speed * this.config.rollFactor;
    this.currentRoll = MathUtils.damp(
      this.currentRoll,
      rollTarget,
      this.config.rollSpringK,
      dt,
    );
    this.camera.rotateZ(this.currentRoll);

    // --- Acceleration/brake pitch (spring toward target, applied in camera-local space) ---
    // Positive accel → nose up; braking (negative accel) → nose down
    const pitchTarget = acceleration * this.config.pitchFactor;
    this.currentPitch = MathUtils.damp(
      this.currentPitch,
      pitchTarget,
      this.config.pitchSpringK,
      dt,
    );
    this.camera.rotateX(this.currentPitch);

    // --- FOV expands with speed ---
    const targetFov = this.config.fov + speedFactor * this.config.fovBoost;
    this.camera.fov = MathUtils.damp(this.camera.fov, targetFov, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.elapsedTime = 0;
    this.currentRoll = 0;
    this.currentPitch = 0;
    this.brakeShudder = 0;
    this.prevBrakeActive = false;
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
