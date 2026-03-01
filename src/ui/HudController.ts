import { GameState, GameStatus } from "@/game/GameState";
import type {
  CurvaturePreviewSample,
  MinimapPathPoint,
} from "@/sim/TrackSampler";
import { MinimapCurvatureWidget } from "@/ui/MinimapCurvatureWidget";
import { HudComponent } from "@/ui/components/Hud";

const LOCKED_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

type HudMetrics = {
  speed: number;
  brake: number;
  comfortRatio: number;
  safeSpeed: number;
  samples: CurvaturePreviewSample[];
  pathPoints: MinimapPathPoint[];
  statusMessage: string;
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
    this.onUsernameClick = onUsernameClick;
    this.handleUsernameClickBound = this.onUsernameClick.bind(this);
    this.onSettingsClick = onSettingsClick;
    this.handleSettingsClickBound = this.onSettingsClick.bind(this);

    this.root = HudComponent({
      gameState: this.gameState,
      onBrakePointerDown: this.handleBrakePointerDownBound,
      onBrakeTouchStart: this.handleBrakeTouchStartBound,
      onUsernameClick: this.handleUsernameClickBound,
      onSettingsClick: this.handleSettingsClickBound,
    });

    // Grab references to elements we need to update
    this.statusBanner = this.root.querySelector(".hud-status-banner") as HTMLDivElement;
    this.speedValue = this.root.querySelector("#hud-speed-value") as HTMLSpanElement;
    this.speedLimitValue = this.root.querySelector("#hud-speed-limit-value") as HTMLSpanElement;
    this.clockValue = this.root.querySelector("#hud-clock-value") as HTMLSpanElement;
    this.etaValue = this.root.querySelector("#hud-eta-value") as HTMLSpanElement;
    this.comfortGauge = this.root.querySelector("#hud-comfort-gauge") as HTMLDivElement;
    this.comfortFill = this.root.querySelector("#hud-comfort-fill") as HTMLDivElement;
    this.comfortValue = this.root.querySelector("#hud-comfort-value") as HTMLSpanElement;
    this.brakeButton = this.root.querySelector("#hud-brake-button") as HTMLButtonElement;
    this.usernameDisplay = this.root.querySelector("#hud-username-display") as HTMLDivElement;
    this.settingsButton = this.root.querySelector(".hud-settings-btn") as HTMLButtonElement;

    // Attach passive: false to touchstart separately because JSX 'on' handlers can't specify passive
    this.brakeButton.addEventListener("touchstart", this.handleBrakeTouchStartBound, { passive: false });

    window.addEventListener("pointerup", this.handleBrakePointerUpBound);
    window.addEventListener("pointercancel", this.handleBrakePointerUpBound);
    window.addEventListener("touchend", this.handleBrakeTouchEndBound);
    window.addEventListener("touchcancel", this.handleBrakeTouchEndBound);
    window.addEventListener("blur", this.handleWindowBlurBound);

    // Mount canvas inside the placeholder
    const minimapCanvas = document.createElement("canvas");
    minimapCanvas.width = 260;
    minimapCanvas.height = 118;
    minimapCanvas.className = "minimap-canvas";
    this.root.querySelector("#minimap-container")!.appendChild(minimapCanvas);
    this.minimapWidget = new MinimapCurvatureWidget(minimapCanvas);

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
      this.gameState.status === GameStatus.Running,
    );
    this.statusBanner.classList.toggle(
      "is-won",
      this.gameState.status === GameStatus.Won,
    );
    this.statusBanner.classList.toggle(
      "is-failed",
      this.gameState.status === GameStatus.Failed,
    );
    this.setBrakeVisual(metrics.brake);
    this.minimapWidget.draw(metrics.pathPoints, metrics.samples, metrics.speed);
    this.usernameDisplay.textContent = this.gameState.username ?? "Login";

    const formatTime = (hours: number) => {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };
    this.clockValue.textContent = formatTime(this.gameState.timeOfDayHours);
    this.etaValue.textContent = formatTime(this.gameState.expectedArrivalHours);
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
