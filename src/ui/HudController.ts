import type {
  CurvaturePreviewSample,
  MinimapPathPoint,
} from "../sim/TrackSampler";
import { MinimapCurvatureWidget } from "./MinimapCurvatureWidget";

type HudMetrics = {
  speed: number;
  brake: number;
  safeSpeed: number;
  samples: CurvaturePreviewSample[];
  pathPoints: MinimapPathPoint[];
};

export class HudController {
  private readonly root: HTMLDivElement;
  private readonly speedValue: HTMLSpanElement;
  private readonly speedLimitValue: HTMLSpanElement;
  private readonly minimapWidget: MinimapCurvatureWidget;
  private readonly onBrakeButtonChange: (isDown: boolean) => void;
  private readonly brakeButton: HTMLButtonElement;
  private brakeButtonDown = false;
  private brakeTouchId: number | null = null;

  constructor(
    container: HTMLElement,
    onBrakeButtonChange: (isDown: boolean) => void = () => {},
  ) {
    this.onBrakeButtonChange = onBrakeButtonChange;

    this.root = document.createElement("div");
    this.root.className = "hud";

    const speedReadout = document.createElement("p");
    speedReadout.className = "hud-speed hud-speed-floating";

    this.speedValue = document.createElement("span");
    this.speedValue.className = "hud-speed-value";
    this.speedValue.textContent = "0";

    const speedUnit = document.createElement("span");
    speedUnit.className = "hud-speed-unit";
    speedUnit.textContent = "kph";

    speedReadout.append(this.speedValue, speedUnit);

    const previewCluster = document.createElement("div");
    previewCluster.className = "hud-preview-cluster";

    const minimapCanvas = document.createElement("canvas");
    minimapCanvas.width = 260;
    minimapCanvas.height = 118;
    minimapCanvas.className = "minimap-canvas";
    previewCluster.appendChild(minimapCanvas);
    this.minimapWidget = new MinimapCurvatureWidget(minimapCanvas);

    const speedLimitSign = document.createElement("div");
    speedLimitSign.className = "speed-limit-sign";

    const speedLimitLabel = document.createElement("span");
    speedLimitLabel.className = "speed-limit-label";
    speedLimitLabel.textContent = "Speed Limit";

    this.speedLimitValue = document.createElement("span");
    this.speedLimitValue.className = "speed-limit-value";
    this.speedLimitValue.textContent = "0";

    const speedLimitUnit = document.createElement("span");
    speedLimitUnit.className = "speed-limit-unit";
    speedLimitUnit.textContent = "kph";

    speedLimitSign.append(
      speedLimitLabel,
      this.speedLimitValue,
      speedLimitUnit,
    );
    previewCluster.appendChild(speedReadout);

    this.brakeButton = document.createElement("button");
    this.brakeButton.type = "button";
    this.brakeButton.className = "brake-button";
    this.brakeButton.textContent = "STOP";
    this.brakeButton.addEventListener("pointerdown", this.onBrakePointerDown);
    this.brakeButton.addEventListener("touchstart", this.onBrakeTouchStart, {
      passive: false,
    });
    window.addEventListener("pointerup", this.onBrakePointerUp);
    window.addEventListener("pointercancel", this.onBrakePointerUp);
    window.addEventListener("touchend", this.onBrakeTouchEnd);
    window.addEventListener("touchcancel", this.onBrakeTouchEnd);
    window.addEventListener("blur", this.onWindowBlur);

    this.root.append(previewCluster, speedLimitSign, this.brakeButton);
    container.appendChild(this.root);
  }

  dispose(): void {
    window.removeEventListener("pointerup", this.onBrakePointerUp);
    window.removeEventListener("pointercancel", this.onBrakePointerUp);
    window.removeEventListener("touchend", this.onBrakeTouchEnd);
    window.removeEventListener("touchcancel", this.onBrakeTouchEnd);
    window.removeEventListener("blur", this.onWindowBlur);
    this.setBrakeButtonDown(false);
  }

  update(metrics: HudMetrics): void {
    this.speedValue.textContent = Math.round(metrics.speed * 3.6).toString();
    this.speedLimitValue.textContent = Math.round(
      metrics.safeSpeed * 3.6,
    ).toString();
    this.setBrakeVisual(metrics.brake);
    this.minimapWidget.draw(metrics.pathPoints, metrics.samples, metrics.speed);
  }

  private setBrakeButtonDown(isDown: boolean): void {
    if (this.brakeButtonDown === isDown) {
      return;
    }

    this.brakeButtonDown = isDown;
    this.brakeButton.classList.toggle("is-pressed", isDown);
    this.onBrakeButtonChange(isDown);
  }

  private setBrakeVisual(value: number): void {
    this.brakeButton.classList.toggle("is-braking", value > 0.01);
  }

  private onBrakePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      return;
    }

    this.setBrakeButtonDown(true);
    event.preventDefault();
  };

  private onBrakePointerUp = (): void => {
    this.setBrakeButtonDown(false);
  };

  private onBrakeTouchStart = (event: TouchEvent): void => {
    if (this.brakeTouchId !== null) {
      return;
    }

    const touch = event.changedTouches.item(0);

    if (!touch) {
      return;
    }

    this.brakeTouchId = touch.identifier;
    this.setBrakeButtonDown(true);
    event.preventDefault();
  };

  private onBrakeTouchEnd = (event: TouchEvent): void => {
    if (this.brakeTouchId === null) {
      return;
    }

    const touch = this.findTouchById(event.changedTouches, this.brakeTouchId);

    if (!touch) {
      return;
    }

    this.brakeTouchId = null;
    this.setBrakeButtonDown(false);
    event.preventDefault();
  };

  private onWindowBlur = (): void => {
    this.brakeTouchId = null;
    this.setBrakeButtonDown(false);
  };

  private findTouchById(touches: TouchList, id: number): Touch | null {
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);

      if (touch && touch.identifier === id) {
        return touch;
      }
    }

    return null;
  }
}
