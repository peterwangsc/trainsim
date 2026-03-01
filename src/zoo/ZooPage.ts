import { MathUtils, Vector3 } from "three";
import { CONFIG } from "@/game/Config";
import { GameState, GameStatus } from "@/game/GameState";
import { preloadCriticalAssets } from "@/loading/CriticalAssetPreloader";
import { Renderer } from "@/render/Renderer";
import { SceneSetup } from "@/render/SceneSetup";
import { TrainHeadlight } from "@/render/TrainHeadlight";
import { FreeCameraController } from "@/zoo/FreeCameraController";
import { ZooPanel } from "@/zoo/ZooPanel";

export class ZooPage {
  private renderer!: Renderer;
  private sceneSetup!: SceneSetup;
  private freeCam!: FreeCameraController;
  private headlight!: TrainHeadlight;
  private panel!: ZooPanel;
  private gameState!: GameState;
  private rafId = 0;
  private lastTime = 0;
  private readonly camForward = new Vector3();

  constructor(private readonly container: HTMLElement) {}

  async init(): Promise<void> {
    this.showLoading();
    const assets = await preloadCriticalAssets();
    this.hideLoading();

    this.renderer = new Renderer(this.container);
    const canvas = this.renderer.getCanvas();
    Object.assign(canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });

    this.gameState = new GameState(null, "zoo");
    this.gameState.level = 1;
    this.gameState.status = GameStatus.Running;

    this.sceneSetup = new SceneSetup(assets, this.gameState, CONFIG);

    this.freeCam = new FreeCameraController(
      canvas,
      CONFIG.camera.fov,
      CONFIG.camera.near,
      CONFIG.camera.far,
    );

    this.headlight = new TrainHeadlight(
      this.sceneSetup.scene,
      this.freeCam.camera,
    );
    this.positionCameraAtStation();

    this.panel = new ZooPanel(this.container, {
      onLevelRebuild: (level) => {
        this.gameState.level = level;
        this.sceneSetup.rebuildScene(this.gameState);
        this.positionCameraAtStation();
      },
      onTimeChange: (t) => {
        this.sceneSetup.skyLayer.setTimeOverride(t);
      },
      onHeadlightToggle: (on) => {
        this.headlight.isEnabled = on;
        this.headlight.update(on ? 1 : 0);
      },
      onLock: () => this.freeCam.lock(),
      onUnlock: () => this.freeCam.unlock(),
    });

    document.addEventListener("pointerlockchange", () => {
      this.panel.setLocked(document.pointerLockElement === canvas);
    });

    window.addEventListener("resize", this.onResize);
    this.onResize();

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private positionCameraAtStation(): void {
    const { stationStartDistance } =
      this.sceneSetup.trackLayer.trackEndSet.getLayout();
    const pos = this.sceneSetup.trackLayer.trackSpline.getPositionAtDistance(
      stationStartDistance - 20,
    );
    const tangent = this.sceneSetup.trackLayer.trackSpline.getTangentAtDistance(
      stationStartDistance - 20,
    );
    this.freeCam.camera.position.set(pos.x, pos.y + 4, pos.z);
    this.freeCam.camera.rotation.order = "YXZ";
    this.freeCam.camera.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.freeCam.update(dt);
    if (this.headlight.isEnabled) {
      this.headlight.update(1);
    }

    this.sceneSetup.update(dt, this.freeCam.camera);

    // Keep the panel time slider in sync when time is free-running
    this.panel.setTimeDisplay(this.sceneSetup.skyLayer.getElapsedFraction());

    this.renderer.setToneMappingExposure(
      MathUtils.clamp(
        this.sceneSetup.skyLayer.getRecommendedExposure(),
        0.3,
        1.5,
      ),
    );
    this.renderer.render(this.sceneSetup.scene, this.freeCam.camera);

    this.rafId = requestAnimationFrame(this.tick);
  };

  private readonly onResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.resize(w, h);
    this.freeCam.camera.aspect = w / h;
    this.freeCam.camera.updateProjectionMatrix();
  };

  private showLoading(): void {
    const el = document.createElement("div");
    el.id = "zoo-loading";
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a10",
      color: "#e8e8ee",
      fontFamily: "monospace",
      fontSize: "14px",
      letterSpacing: "0.1em",
      zIndex: "10000",
    });
    el.textContent = "Zoo — loading assets…";
    document.body.appendChild(el);
  }

  private hideLoading(): void {
    document.getElementById("zoo-loading")?.remove();
  }
}
