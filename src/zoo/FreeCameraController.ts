import { MathUtils, PerspectiveCamera, Vector3 } from "three";

const BASE_MOVE_SPEED = 30; // m/s
const FAST_MULTIPLIER = 5;
const LOOK_SENSITIVITY = 0.002;

export class FreeCameraController {
  readonly camera: PerspectiveCamera;

  private yaw = 0;
  private pitch = 0;
  private isLocked = false;
  private readonly keysDown = new Set<string>();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly move = new Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    fov: number,
    near: number,
    far: number,
  ) {
    this.camera = new PerspectiveCamera(
      fov,
      canvas.clientWidth / canvas.clientHeight,
      near,
      far,
    );

    this.canvas.addEventListener("click", this.onCanvasClick);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
  }

  get locked(): boolean {
    return this.isLocked;
  }

  lock(): void {
    void this.canvas.requestPointerLock();
  }

  unlock(): void {
    document.exitPointerLock();
  }

  update(dt: number): void {
    const speed =
      BASE_MOVE_SPEED *
      (this.keysDown.has("ShiftLeft") || this.keysDown.has("ShiftRight")
        ? FAST_MULTIPLIER
        : 1);

    this.camera.getWorldDirection(this.forward);
    this.right.crossVectors(this.forward, this.camera.up).normalize();
    this.move.set(0, 0, 0);

    if (this.keysDown.has("KeyW")) this.move.add(this.forward);
    if (this.keysDown.has("KeyS")) this.move.sub(this.forward);
    if (this.keysDown.has("KeyD")) this.move.add(this.right);
    if (this.keysDown.has("KeyA")) this.move.sub(this.right);
    if (this.keysDown.has("Space")) this.move.y += 1;
    if (this.keysDown.has("KeyQ")) this.move.y -= 1;

    if (this.move.lengthSq() > 0) {
      this.move.normalize().multiplyScalar(speed * dt);
      this.camera.position.add(this.move);
    }
  }

  dispose(): void {
    this.canvas.removeEventListener("click", this.onCanvasClick);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
  }

  private readonly onCanvasClick = (): void => {
    this.lock();
  };

  private readonly onPointerLockChange = (): void => {
    this.isLocked = document.pointerLockElement === this.canvas;
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isLocked) return;
    this.yaw -= e.movementX * LOOK_SENSITIVITY;
    this.pitch -= e.movementY * LOOK_SENSITIVITY;
    this.pitch = MathUtils.clamp(
      this.pitch,
      -Math.PI / 2 + 0.01,
      Math.PI / 2 - 0.01,
    );
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };
}
