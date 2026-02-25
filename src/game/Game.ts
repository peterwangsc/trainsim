import { MathUtils } from "three";
import { CONFIG } from "./Config";
import { GameLoop } from "./GameLoop";
import { GameStatus, GameState } from "./GameState";
import { ComfortModel } from "../sim/ComfortModel";
import { TrackSampler } from "../sim/TrackSampler";
import { TrainSim } from "../sim/TrainSim";
import { DesktopControls } from "../input/DesktopControls";
import { InputManager } from "../input/InputManager";
import { CameraRig } from "../render/CameraRig";
import { Renderer } from "../render/Renderer";
import { TrainHeadlight } from "../render/TrainHeadlight";
import { SceneSetup } from "../render/SceneSetup";
import { CabinChrome } from "../ui/CabinChrome";
import { HudController } from "../ui/HudController";
import { IntroSplash } from "../ui/IntroSplash";
import { RunEndOverlay } from "../ui/RunEndOverlay";
import { LoginScreen } from "../ui/LoginScreen";
import { ThrottleOverlayCanvas } from "../ui/ThrottleOverlayCanvas";
import { TrackGenerator } from "../world/Track/TrackGenerator";
import { TrackSpline } from "../world/Track/TrackSpline";
import type {
  CurvaturePreviewSample,
  MinimapPathPoint,
} from "../sim/TrackSampler";
import { TrainMovementAudio } from "../audio/TrainMovementAudio";
import { RandomAmbientAudio } from "../audio/RandomAmbientAudio";
import { GameMusic } from "../audio/GameMusic";
import type { CriticalPreloadedAssets } from "../loading/CriticalAssetPreloader";

type GameOptions = {
  level: number;
  onRestartRequested?: () => void;
  onNextLevelRequested?: () => void;
  preloadedAssets: CriticalPreloadedAssets;
  onLogin?: (username: string, targetLevel: number) => void;
  onLogout?: () => void;
  username?: string | null;
};

export class Game {
  private readonly renderer: Renderer;
  private readonly sceneSetup: SceneSetup;
  private readonly cameraRig: CameraRig;
  private readonly headlight: TrainHeadlight;
  private readonly inputManager: InputManager;
  private readonly cabinChrome: CabinChrome;
  private readonly introSplash: IntroSplash;
  private readonly runEndOverlay: RunEndOverlay;
  private readonly throttleOverlay: ThrottleOverlayCanvas;
  private readonly trainSim: TrainSim;
  private readonly comfortModel: ComfortModel;
  private readonly trackSampler: TrackSampler;
  private readonly hud: HudController;
  private readonly loop: GameLoop;
  private readonly trainMovementAudio: TrainMovementAudio;
  private readonly brakePressureAudio: TrainMovementAudio;
  private readonly randomAmbientAudio: RandomAmbientAudio;
  private readonly gameMusic: GameMusic;
  private toneMappingExposure = 1;
  private readonly onRestartRequested: () => void;
  private readonly onNextLevelRequested?: () => void;
  private readonly onLogin?: (username: string, targetLevel: number) => void;
  private readonly onLogout?: () => void;
  private readonly username: string | null;
  private readonly level: number;
  private readonly loginScreen: LoginScreen;

  private readonly gameState: GameState;

  private readonly handleResizeBound: () => void;
  private readonly handleDebugLookKeyDownBound: (event: KeyboardEvent) => void;
  private readonly handleDebugLookMouseMoveBound: (event: MouseEvent) => void;

  constructor(
    private readonly container: HTMLElement,
    options: GameOptions,
  ) {
    this.handleResizeBound = this.handleResize.bind(this);
    this.handleDebugLookKeyDownBound = this.handleDebugLookKeyDown.bind(this);
    this.handleDebugLookMouseMoveBound = this.handleDebugLookMouseMove.bind(this);

    this.onRestartRequested =
      options.onRestartRequested ?? (() => this.restart());
    this.onNextLevelRequested = options.onNextLevelRequested;
    this.onLogin = options.onLogin;
    this.onLogout = options.onLogout;
    this.username = options.username ?? null;
    this.level = options.level;
    const preloadedAssets = options.preloadedAssets;

    this.loginScreen = new LoginScreen(
      container,
      this.onLogin
        ? (username: string, targetLevel?: number | undefined) =>
            this.onLogin!(username, targetLevel ?? this.level)
        : undefined,
      this.username ? this.onLogout : undefined,
      this.username,
      this.level,
    );

    const trackConfig = {
      ...CONFIG.track,
      segmentCount: CONFIG.track.segmentCount + (this.level - 1) * 160,
      baseCurvaturePerMeter:
        CONFIG.track.baseCurvaturePerMeter * (1 + (this.level - 1) * 0.25),
      detailCurvaturePerMeter:
        CONFIG.track.detailCurvaturePerMeter * (1 + (this.level - 1) * 0.25),
    };
    const seed = CONFIG.seed + this.level - 1;
    const trackPoints = new TrackGenerator(seed, trackConfig).generate();
    const trackSpline = new TrackSpline(trackPoints, { closed: false });

    this.sceneSetup = new SceneSetup(trackSpline, preloadedAssets, this.level);
    this.gameState = new GameState(this.level, this.sceneSetup.trackEndSet.getLayout());

    this.renderer = new Renderer(container);
    this.introSplash = new IntroSplash(container);
    this.runEndOverlay = new RunEndOverlay(container);

    this.cameraRig = new CameraRig(
      trackSpline,
      CONFIG.camera,
      container.clientWidth / container.clientHeight,
    );

    this.headlight = new TrainHeadlight(this.sceneSetup.scene);

    const desktopControls = new DesktopControls({
      throttleRatePerSecond: CONFIG.train.throttleRatePerSecond,
      brakeRampSeconds: CONFIG.train.brakeRampSeconds,
    });

    this.inputManager = new InputManager(desktopControls);
    this.cabinChrome = new CabinChrome(container);
    this.throttleOverlay = new ThrottleOverlayCanvas(container, (value) => {
      desktopControls.setThrottle(value);
    });

    this.trainSim = new TrainSim(CONFIG.train);
    this.trainMovementAudio = new TrainMovementAudio({
      srcs: CONFIG.audio.movementTrackSrcs,
      maxTrainSpeed: CONFIG.train.maxSpeed,
      movementThreshold: CONFIG.audio.movementThreshold,
      minVolume: CONFIG.audio.minVolume,
      maxVolume: CONFIG.audio.maxVolume,
      releaseFadeSeconds: CONFIG.audio.movementReleaseFadeSeconds,
      preloadedHowls: preloadedAssets.movementHowls,
    });
    this.brakePressureAudio = new TrainMovementAudio({
      srcs: CONFIG.audio.brakeTrackSrcs,
      maxTrainSpeed: 1,
      movementThreshold: CONFIG.audio.brakePressureThreshold,
      minVolume: CONFIG.audio.brakeMinVolume,
      maxVolume: CONFIG.audio.brakeMaxVolume,
      releaseFadeSeconds: CONFIG.audio.brakeReleaseFadeSeconds,
      preloadedHowls: preloadedAssets.brakeHowls,
    });
    this.randomAmbientAudio = new RandomAmbientAudio({
      tracks: CONFIG.audio.ambientTrackSrcs,
      volume: CONFIG.audio.ambientVolume,
      minGapMs: CONFIG.audio.ambientMinGapMs,
      maxGapMs: CONFIG.audio.ambientMaxGapMs,
      preloadedHowls: preloadedAssets.ambientHowls,
    });
    this.gameMusic = new GameMusic({
      tracks: CONFIG.audio.musicTrackSrcs,
      volume: CONFIG.audio.musicVolume,
      fadeInMs: CONFIG.audio.musicFadeInMs,
      fadeOutAtMs: CONFIG.audio.musicFadeOutAtMs,
      fadeOutMs: CONFIG.audio.musicFadeOutMs,
      gapMs: CONFIG.audio.musicGapMs,
      preloadedFirstTrackHowl: preloadedAssets.musicTrack1Howl,
    });
    this.comfortModel = new ComfortModel(CONFIG.comfort);
    this.trackSampler = new TrackSampler(trackSpline, CONFIG.minimap);
    this.hud = new HudController(
      container,
      (isDown) => {
        desktopControls.setBrakeButtonDown(isDown);
      },
      this.username,
      () => {
        this.loginScreen.show();
      },
    );

    this.loop = new GameLoop(
      CONFIG.simDt,
      (dt) => this.simulate(dt),
      () => this.render(),
    );

    window.addEventListener("resize", this.handleResizeBound);
    window.addEventListener("keydown", this.handleDebugLookKeyDownBound);
    window.addEventListener("mousemove", this.handleDebugLookMouseMoveBound);
    window.visualViewport?.addEventListener("resize", this.handleResizeBound);
    window.visualViewport?.addEventListener("scroll", this.handleResizeBound);
    this.handleResize();
    this.renderer.compile(this.sceneSetup.scene, this.cameraRig.camera);
    this.simulate(0);
  }

  public start(): void {
    this.gameState.status = GameStatus.Running;
    this.introSplash.start();
    this.gameMusic.start();
    this.randomAmbientAudio.start();
    this.loop.start();
  }

  public stop(): void {
    this.loop.stop();
    this.cabinChrome.dispose();
    this.introSplash.dispose();
    this.runEndOverlay.dispose();
    this.throttleOverlay.dispose();
    this.inputManager.dispose();
    this.hud.dispose();
    this.sceneSetup.dispose();
    this.headlight.dispose();
    this.trainMovementAudio.dispose();
    this.brakePressureAudio.dispose();
    this.randomAmbientAudio.dispose();
    this.gameMusic.dispose();
    this.renderer.dispose();

    window.removeEventListener("resize", this.handleResizeBound);
    window.removeEventListener("keydown", this.handleDebugLookKeyDownBound);
    window.removeEventListener("mousemove", this.handleDebugLookMouseMoveBound);
    window.visualViewport?.removeEventListener("resize", this.handleResizeBound);
    window.visualViewport?.removeEventListener("scroll", this.handleResizeBound);
  }

  public restart(): void {
    this.loop.stop();
    this.runEndOverlay.reset();
    this.cameraRig.reset();
    this.trainSim.reset();
    this.inputManager.reset();
    this.throttleOverlay.reset();
    this.comfortModel.reset();
    this.gameState.reset();
    this.loop.start();
  }

  private simulate(dt: number): void {
    const previousStatus = this.gameState.status;
    const input = this.inputManager.update(dt);

    if (this.gameState.status !== GameStatus.Running && this.gameState.status !== GameStatus.Ready) {
      this.trainSim.setControls({ throttle: 0, brake: 1 });
    } else {
      this.trainSim.setControls(input);
    }

    this.trainSim.update(dt);

    const train = this.trainSim.getState(dt);
    const trackSpline = this.sceneSetup.trackSpline;
    const trackLength = trackSpline.getLength();
    const wrappedDistance = trackSpline.isClosed()
      ? train.distance % trackLength
      : Math.min(train.distance, trackLength);

    const samples = this.trackSampler.sampleAhead(wrappedDistance);
    const pathPoints = this.trackSampler.samplePathAhead(wrappedDistance);
    const safetyProbe = samples[Math.min(1, samples.length - 1)];
    const curvatureSafeSpeed = safetyProbe?.safeSpeed ?? CONFIG.minimap.safeSpeedMax;

    const comfort = this.comfortModel.update(
      {
        speed: train.speed,
        safeSpeed: curvatureSafeSpeed,
        accel: train.accel,
        jerk: train.jerk,
      },
      dt,
    );

    this.gameState.update(train.distance, wrappedDistance, train.speed, comfort, curvatureSafeSpeed);

    if (previousStatus === GameStatus.Running && this.gameState.status !== GameStatus.Running) {
      this.showRunEndOverlay();
    }

    const controls = this.gameState.status === GameStatus.Running
        ? this.trainSim.getControls()
        : { throttle: 0, brake: 1 };

    const trainSpeedRatio = MathUtils.clamp(
      train.speed / CONFIG.train.maxSpeed,
      0,
      1,
    );
    const brakeLinear = controls.brake * trainSpeedRatio;
    const brakeAudioDrive =
      brakeLinear <= 0 ? 0 : Math.log(1 + 9 * brakeLinear) / Math.log(10);
    this.trainMovementAudio.update(train.speed, dt);
    this.brakePressureAudio.update(brakeAudioDrive, dt);

    this.cameraRig.update(wrappedDistance, train.speed, dt);
    this.sceneSetup.update(dt, this.cameraRig.camera);

    const targetExposure = this.sceneSetup.dayNightSky.getRecommendedExposure();
    this.toneMappingExposure = MathUtils.damp(
      this.toneMappingExposure,
      targetExposure,
      2.25,
      dt,
    );
    this.renderer.setToneMappingExposure(this.toneMappingExposure);
    
    const position = trackSpline.getPositionAtDistance(wrappedDistance);
    const tangent = trackSpline.getTangentAtDistance(wrappedDistance);
    this.headlight.update(wrappedDistance, tangent, position, this.sceneSetup.dayNightSky.getNightFactor());
  }

  private render(): void {
    this.throttleOverlay.update(this.trainSim.getControls().throttle);
    this.renderer.render(this.sceneSetup.scene, this.cameraRig.camera);
    this.hud.update({
      speed: this.gameState.speed,
      brake: this.trainSim.getControls().brake,
      comfortRatio: this.gameState.comfortRatio,
      safeSpeed: this.gameState.safeSpeed,
      samples: this.trackSampler.sampleAhead(this.gameState.wrappedDistance),
      pathPoints: this.trackSampler.samplePathAhead(this.gameState.wrappedDistance),
      status: this.gameState.getHudStatus(),
      statusMessage: this.gameState.getStatusMessage(),
    });
  }

  private handleDebugLookKeyDown(event: KeyboardEvent): void {
    if (event.code !== "KeyP" || !event.shiftKey || event.repeat) {
      return;
    }

    event.preventDefault();
    this.cameraRig.setDebugLookEnabled(!this.cameraRig.isDebugLookEnabled());
  }

  private handleDebugLookMouseMove(event: MouseEvent): void {
    if (!this.cameraRig.isDebugLookEnabled()) {
      return;
    }

    this.cameraRig.addDebugLookDelta(event.movementX, event.movementY);
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    this.renderer.resize(width, height);
    this.cameraRig.onResize(width, height);
    this.throttleOverlay.onResize(width, height);
  }

  private showRunEndOverlay(): void {
    if (this.gameState.status === GameStatus.Won) {
      this.runEndOverlay.show({
        tone: "won",
        title: "Station Stop Complete",
        message: "You stopped before the platform end.",
        onRestart: this.onRestartRequested,
        onNextLevel: this.onNextLevelRequested,
        onLogin: this.onLogin
          ? (username) => this.onLogin!(username, this.level + 1)
          : undefined,
        username: this.username,
      });
      return;
    }

    const isBumperImpact = this.gameState.failureReason === "BUMPER";
    this.runEndOverlay.show({
      tone: "failed",
      title: isBumperImpact ? "Bumper Impact" : "Run Failed",
      message: isBumperImpact
        ? "You hit the terminal bumper."
        : "Passengers could not tolerate the ride.",
      onRestart: this.onRestartRequested,
      onLogin: this.onLogin
        ? (username) => this.onLogin!(username, this.level)
        : undefined,
      username: this.username,
    });
  }
}
