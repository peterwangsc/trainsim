import { PerspectiveCamera, Vector3 } from 'three';
import { TrackSpline } from '../world/Track/TrackSpline';

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
  private elapsedTime = 0;

  constructor(
    private readonly spline: TrackSpline,
    private readonly config: CameraRigConfig,
    aspect: number
  ) {
    this.camera = new PerspectiveCamera(config.fov, aspect, config.near, config.far);
  }

  update(distance: number, speed: number, dt: number): void {
    this.elapsedTime += dt;

    const position = this.spline.getPositionAtDistance(distance);
    const tangent = this.spline.getTangentAtDistance(distance);
    const right = new Vector3().crossVectors(tangent, new Vector3(0, 1, 0)).normalize();
    const backOffset = this.spline.isClosed()
      ? this.config.eyeBackOffset
      : Math.min(this.config.eyeBackOffset, Math.max(0, distance));

    const sway = Math.sin(this.elapsedTime * this.config.swayFrequency)
      * this.config.swayAmplitude
      * Math.min(speed / 30, 1);

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
    this.camera.lookAt(lookAt);
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
