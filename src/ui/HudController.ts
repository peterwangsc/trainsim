import { GameState } from "../game/GameState";
import type {
  CurvaturePreviewSample,
  MinimapPathPoint,
} from "../sim/TrackSampler";
import { MinimapCurvatureWidget } from "./MinimapCurvatureWidget";

const LOCKED_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

type HudMetrics = {
  speed: number;
  brake: number;
  comfortRatio: number;
  safeSpeed: number;
  samples: CurvaturePreviewSample[];
  pathPoints: MinimapPathPoint[];
  status: "running" | "won" | "failed";
  statusMessage: string;
  gameState: GameState;
};

export class HudController {
  private static viewportLockApplied = false;
  private readonly root: HTMLDivElement;
  private readonly gameState: GameState;
  private readonly statusBanner: HTMLDivElement;
  private readonly comfortGauge: HTMLDivElement;
  private readonly comfortFill: HTMLDivElement;
  private readonly comfortValue: HTMLSpanElement;
  private readonly speedValue: HTMLSpanElement;
  private readonly speedLimitValue: HTMLSpanElement;
  private readonly clockValue: HTMLSpanElement;
  private readonly etaValue: HTMLSpanElement;
  private readonly minimapWidget: MinimapCurvatureWidget;
  private readonly onBrakeButtonChange: (isDown: boolean) => void;
  private readonly brakeButton: HTMLButtonElement;
  private readonly usernameDisplay: HTMLDivElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly onUsernameClick: () => void;
  private readonly onSettingsClick: () => void;
  private brakeButtonDown = false;
  private brakeTouchId: number | null = null;

  private readonly handleBrakePointerDownBound: (event: PointerEvent) => void;
  private readonly handleBrakeTouchStartBound: (event: TouchEvent) => void;
  private readonly handleBrakePointerUpBound: () => void;
  private readonly handleBrakeTouchEndBound: (event: TouchEvent) => void;
  private readonly handleWindowBlurBound: () => void;
  private readonly handleUsernameClickBound: () => void;
  private readonly handleSettingsClickBound: () => void;

  constructor(
    container: HTMLElement,
    onBrakeButtonChange: (isDown: boolean) => void = () => {},
    onUsernameClick: () => void = () => {},
    onSettingsClick: () => void = () => {},
    gameState: GameState,
  ) {
    this.onBrakeButtonChange = onBrakeButtonChange;
    this.lockMobileViewportScale();

    this.handleBrakePointerDownBound = this.handleBrakePointerDown.bind(this);
    this.handleBrakeTouchStartBound = this.handleBrakeTouchStart.bind(this);
    this.handleBrakePointerUpBound = this.handleBrakePointerUp.bind(this);
    this.handleBrakeTouchEndBound = this.handleBrakeTouchEnd.bind(this);
    this.handleWindowBlurBound = this.handleWindowBlur.bind(this);

    this.gameState = gameState;

    this.root = document.createElement("div");
    this.root.className = "hud";

    this.statusBanner = document.createElement("div");
    this.statusBanner.className = "hud-status-banner";
    this.statusBanner.textContent =
      "Drive to the terminal station and stop before the platform ends.";

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

    const timeCluster = document.createElement("div");
    timeCluster.className = "hud-time-cluster";

    const clockLabel = document.createElement("span");
    clockLabel.className = "hud-time-label";
    clockLabel.textContent = "Time";

    this.clockValue = document.createElement("span");
    this.clockValue.className = "hud-time-value";

    const etaLabel = document.createElement("span");
    etaLabel.className = "hud-time-label hud-time-label--eta";
    etaLabel.textContent = "ETA";

    this.etaValue = document.createElement("span");
    this.etaValue.className = "hud-time-value hud-time-value--eta";

    timeCluster.append(clockLabel, this.clockValue, etaLabel, this.etaValue);

    this.comfortGauge = document.createElement("div");
    this.comfortGauge.className = "comfort-gauge";

    const comfortLabel = document.createElement("span");
    comfortLabel.className = "comfort-gauge-label";
    comfortLabel.textContent = "Comfort";

    const comfortTrack = document.createElement("div");
    comfortTrack.className = "comfort-gauge-track";

    this.comfortFill = document.createElement("div");
    this.comfortFill.className = "comfort-gauge-fill";
    comfortTrack.appendChild(this.comfortFill);

    this.comfortValue = document.createElement("span");
    this.comfortValue.className = "comfort-gauge-value";
    this.comfortValue.textContent = "100%";

    this.comfortGauge.append(comfortLabel, comfortTrack, this.comfortValue);

    this.brakeButton = document.createElement("button");
    this.brakeButton.type = "button";
    this.brakeButton.className = "brake-button";
    this.brakeButton.textContent = "STOP";
    this.brakeButton.addEventListener(
      "pointerdown",
      this.handleBrakePointerDownBound,
    );
    this.brakeButton.addEventListener(
      "touchstart",
      this.handleBrakeTouchStartBound,
      {
        passive: false,
      },
    );
    window.addEventListener("pointerup", this.handleBrakePointerUpBound);
    window.addEventListener("pointercancel", this.handleBrakePointerUpBound);
    window.addEventListener("touchend", this.handleBrakeTouchEndBound);
    window.addEventListener("touchcancel", this.handleBrakeTouchEndBound);
    window.addEventListener("blur", this.handleWindowBlurBound);

    this.onUsernameClick = onUsernameClick;
    this.handleUsernameClickBound = this.onUsernameClick.bind(this);

    this.onSettingsClick = onSettingsClick;
    this.handleSettingsClickBound = this.onSettingsClick.bind(this);

    this.usernameDisplay = document.createElement("div");
    this.usernameDisplay.className = "username-display";
    this.usernameDisplay.textContent = this.gameState.username ?? "Login";
    this.usernameDisplay.addEventListener(
      "click",
      this.handleUsernameClickBound,
    );

    this.settingsButton = document.createElement("button");
    this.settingsButton.className = "hud-settings-btn";
    this.settingsButton.type = "button";
    this.settingsButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    this.settingsButton.addEventListener("click", this.handleSettingsClickBound);

    this.root.append(
      this.statusBanner,
      previewCluster,
      speedLimitSign,
      timeCluster,
      this.comfortGauge,
      this.brakeButton,
      this.usernameDisplay,
      this.settingsButton,
    );
    container.appendChild(this.root);
  }

  public dispose(): void {
    this.brakeButton.removeEventListener(
      "pointerdown",
      this.handleBrakePointerDownBound,
    );
    this.brakeButton.removeEventListener(
      "touchstart",
      this.handleBrakeTouchStartBound,
    );
    window.removeEventListener("pointerup", this.handleBrakePointerUpBound);
    window.removeEventListener("pointercancel", this.handleBrakePointerUpBound);
    window.removeEventListener("touchend", this.handleBrakeTouchEndBound);
    window.removeEventListener("touchcancel", this.handleBrakeTouchEndBound);
    window.removeEventListener("blur", this.handleWindowBlurBound);
    this.usernameDisplay.removeEventListener(
      "click",
      this.handleUsernameClickBound,
    );
    this.settingsButton.removeEventListener(
      "click",
      this.handleSettingsClickBound,
    );

    this.setBrakeButtonDown(false);
    this.root.remove();
  }

  public update(metrics: HudMetrics): void {
    this.speedValue.textContent = Math.round(metrics.speed * 3.6).toString();
    this.speedLimitValue.textContent = Math.round(
      metrics.safeSpeed * 3.6,
    ).toString();
    const comfortRatio = Math.min(1, Math.max(0, metrics.comfortRatio));
    this.comfortFill.style.height = `${Math.round(comfortRatio * 100)}%`;
    this.comfortValue.textContent = `${Math.round(comfortRatio * 100)}%`;
    this.comfortGauge.classList.toggle("is-low", comfortRatio < 0.3);
    this.comfortGauge.classList.toggle(
      "is-warning",
      comfortRatio >= 0.3 && comfortRatio < 0.55,
    );
    this.statusBanner.textContent = metrics.statusMessage;
    this.statusBanner.classList.toggle(
      "is-running",
      metrics.status === "running",
    );
    this.statusBanner.classList.toggle("is-won", metrics.status === "won");
    this.statusBanner.classList.toggle(
      "is-failed",
      metrics.status === "failed",
    );
    this.setBrakeVisual(metrics.brake);
    this.minimapWidget.draw(metrics.pathPoints, metrics.samples, metrics.speed);
    this.usernameDisplay.textContent = this.gameState.username ?? "Login";

    const formatTime = (hours: number) => {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };
    this.clockValue.textContent = formatTime(metrics.gameState.timeOfDayHours);
    this.etaValue.textContent = formatTime(
      metrics.gameState.expectedArrivalHours,
    );
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

  private handleBrakePointerDown(event: PointerEvent): void {
    if (event.pointerType === "touch") {
      return;
    }

    this.setBrakeButtonDown(true);
    event.preventDefault();
  }

  private handleBrakePointerUp(): void {
    this.setBrakeButtonDown(false);
  }

  private handleBrakeTouchStart(event: TouchEvent): void {
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
  }

  private handleBrakeTouchEnd(event: TouchEvent): void {
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
  }

  private handleWindowBlur(): void {
    this.brakeTouchId = null;
    this.setBrakeButtonDown(false);
  }

  private findTouchById(touches: TouchList, id: number): Touch | null {
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);

      if (touch && touch.identifier === id) {
        return touch;
      }
    }

    return null;
  }

  private lockMobileViewportScale(): void {
    if (HudController.viewportLockApplied || navigator.maxTouchPoints <= 0) {
      return;
    }

    let viewportMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );

    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.name = "viewport";
      document.head.appendChild(viewportMeta);
    }

    viewportMeta.content = LOCKED_VIEWPORT_CONTENT;
    HudController.viewportLockApplied = true;
  }
}
