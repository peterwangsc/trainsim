import { clamp } from '../util/Math';

export type DesktopControlsConfig = {
  throttleRatePerSecond: number;
  brakeRampSeconds: number;
};

export type InputState = {
  throttle: number;
  brake: number;
};

export class DesktopControls {
  private readonly pressedKeys = new Set<string>();
  private throttle = 0;
  private brake = 0;
  private brakeButtonDown = false;
  private brakeHoldTime = 0;
  private brakePulseTime = 0;
  private wasBrakeDown = false;

  constructor(private readonly config: DesktopControlsConfig) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  update(dt: number): InputState {
    const throttleUp = this.isDown('KeyW') || this.isDown('ArrowUp');
    const throttleDown = this.isDown('KeyS') || this.isDown('ArrowDown');

    const throttleDelta = this.config.throttleRatePerSecond * dt;

    if (throttleUp && !throttleDown) {
      this.throttle = clamp(this.throttle + throttleDelta, 0, 1);
    }

    if (throttleDown && !throttleUp) {
      this.throttle = clamp(this.throttle - throttleDelta, 0, 1);
    }

    const brakeDown =
      this.brakeButtonDown || this.isDown('Space') || this.isDown('KeyB');

    if (brakeDown) {
      this.brakeHoldTime += dt;
      this.brake = clamp(this.brakeHoldTime / this.config.brakeRampSeconds, 0, 1);
    } else {
      if (this.wasBrakeDown && this.brakeHoldTime < 0.2) {
        this.brakePulseTime = 0.16;
      }

      this.brakeHoldTime = 0;
      this.brake = 0;
    }

    this.wasBrakeDown = brakeDown;

    if (this.brakePulseTime > 0) {
      this.brakePulseTime = Math.max(0, this.brakePulseTime - dt);
      const pulseStrength = this.brakePulseTime / 0.16;
      this.brake = Math.max(this.brake, 0.45 * pulseStrength);
    }

    return {
      throttle: this.throttle,
      brake: this.brake
    };
  }

  setThrottle(value: number): void {
    this.throttle = clamp(value, 0, 1);
  }

  setBrakeButtonDown(isDown: boolean): void {
    this.brakeButtonDown = isDown;
  }

  private isDown(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private onBlur = (): void => {
    this.pressedKeys.clear();
    this.brakeButtonDown = false;
    this.brake = 0;
    this.brakeHoldTime = 0;
  };
}
