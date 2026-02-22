import { DesktopControls, type InputState } from './DesktopControls';

export class InputManager {
  private readonly desktopControls: DesktopControls;

  constructor(desktopControls: DesktopControls) {
    this.desktopControls = desktopControls;
  }

  update(dt: number): InputState {
    return this.desktopControls.update(dt);
  }

  dispose(): void {
    this.desktopControls.dispose();
  }
}
