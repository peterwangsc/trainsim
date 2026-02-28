import { MathUtils } from "three";
import { Howler } from "howler";
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
import { SettingsScreen } from "../ui/SettingsScreen";
import { ThrottleOverlayCanvas } from "../ui/ThrottleOverlayCanvas";
import { TrainMovementAudio } from "../audio/TrainMovementAudio";
import { RandomAmbientAudio } from "../audio/RandomAmbientAudio";
import { GameMusic } from "../audio/GameMusic";
import type { CriticalPreloadedAssets } from "../loading/CriticalAssetPreloader";
import {
  getOrCreateUserId,
  login,
  saveProgress,
  getUsernameFromLocalStorage,
} from "../util/Username";
import { LoadingScreenManager } from "../loading/LoadingScreenManager";

export class Game {
  private readonly config: typeof CONFIG;
  private readonly renderer: Renderer;
  private readonly loadingScreenManager: LoadingScreenManager;
  private readonly handleResizeBound: () => void;

  private currentLoadedLevel: number | null = null;

  // 3d visuals
  private preloadedAssets!: CriticalPreloadedAssets;
  private sceneSetup!: SceneSetup;
  private gameState!: GameState;
  private cameraRig!: CameraRig;
  private headlight!: TrainHeadlight;
  private toneMappingExposure = 1;

  // ui and controls
  private desktopControls!: DesktopControls;
  private inputManager!: InputManager;
  private cabinChrome!: CabinChrome;
  private introSplash!: IntroSplash;
  private runEndOverlay!: RunEndOverlay;
  private throttleOverlay!: ThrottleOverlayCanvas;
  private hud!: HudController;
  private loginScreen!: LoginScreen;
  private settingsScreen!: SettingsScreen;

  // simulation
  private trainSim!: TrainSim;
  private comfortModel!: ComfortModel;
  private trackSampler!: TrackSampler;
  private trainMovementAudio!: TrainMovementAudio;
  private brakePressureAudio!: TrainMovementAudio;
  private randomAmbientAudio!: RandomAmbientAudio;
  private gameMusic!: GameMusic;
  private loop!: GameLoop;

  private lastMasterVolume = -1;
  private lastMusicVolume = -1;
  private lastSfxVolume = -1;

  constructor(
    private readonly container: HTMLElement,
    config: typeof CONFIG,
  ) {
    this.config = config;
    this.renderer = new Renderer(container);
    this.gameState = new GameState(
      getUsernameFromLocalStorage(),
      getOrCreateUserId(),
      this.config,
    );
    this.loadingScreenManager = new LoadingScreenManager(
      container,
      this.gameState,
      () => {
        this.start();
        this.startLevel(
          this.gameState.level,
          this.gameState.userId,
          this.gameState.username,
        );
      },
    );
    this.handleResizeBound = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResizeBound);
    window.visualViewport?.addEventListener("resize", this.handleResizeBound);
    window.visualViewport?.addEventListener("scroll", this.handleResizeBound);
  }

  public async preload(): Promise<void> {
    const { assets } = await this.loadingScreenManager.preload();
    this.preloadedAssets = assets;
    this.initSystems();
  }

  public start(): void {
    this.gameState.status = GameStatus.Running;
    this.introSplash.start();
    this.gameMusic.start();
    this.randomAmbientAudio.start();
  }

  public stop(): void {
    this.disposeSystems();
    this.renderer.dispose();
    window.removeEventListener("resize", this.handleResizeBound);
    window.visualViewport?.removeEventListener(
      "resize",
      this.handleResizeBound,
    );
    window.visualViewport?.removeEventListener(
      "scroll",
      this.handleResizeBound,
    );
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

  private startLevel(
    level: number,
    userId: string,
    username: string | null,
  ): void {
    this.loop.stop();
    this.gameState.update({
      level,
      username,
      userId,
      status: GameStatus.Running,
    });
    if (level !== this.currentLoadedLevel) {
      this.sceneSetup.rebuildScene(this.gameState);
      this.currentLoadedLevel = level;
    }
    this.runEndOverlay.reset();
    this.cameraRig.updateSpline(this.sceneSetup.trackSpline);
    this.trackSampler.updateSpline(this.sceneSetup.trackSpline);
    this.trainSim.reset();
    this.inputManager.reset();
    this.throttleOverlay.reset();
    this.comfortModel.reset();
    this.gameState.reset();
    this.loginScreen.reset();
    this.settingsScreen.reset();

    const expectedDuration = this.trackSampler.computeExpectedDuration(
      this.sceneSetup.trackSpline.getLength(),
      this.config.terminal.parTimeBaseSpeed,
    );
    this.gameState.update({ expectedDuration });

    this.simulate(0);
    this.gameState.update({
      sceneSetup: this.sceneSetup,
    });
    this.loop.start();
  }

  private initSystems(): void {
    this.initVisuals();
    this.initUiControls();
    this.initAudio();
    this.initSimulation();
    this.handleResize();
    this.renderer.compile(this.sceneSetup.scene, this.cameraRig.camera);
    this.simulate(0);
    this.gameState.update({
      sceneSetup: this.sceneSetup,
    });
    this.currentLoadedLevel = this.gameState.level;
  }

  private disposeSystems(): void {
    this.loop.stop();
    this.cabinChrome.dispose();
    this.introSplash.dispose();
    this.runEndOverlay.dispose();
    this.throttleOverlay.dispose();
    this.inputManager.dispose();
    this.hud.dispose();
    this.loginScreen.dispose();
    this.settingsScreen.dispose();
    this.sceneSetup.dispose();
    this.headlight.dispose();
    this.cameraRig.dispose();
    this.trainMovementAudio.dispose();
    this.brakePressureAudio.dispose();
    this.randomAmbientAudio.dispose();
    this.gameMusic.dispose();
  }

  private applyAudioVolumes(): void {
    if (this.lastMasterVolume !== this.gameState.masterVolume) {
      this.lastMasterVolume = this.gameState.masterVolume;
      Howler.volume(this.gameState.masterVolume);
    }
    if (this.lastMusicVolume !== this.gameState.musicVolume) {
      this.lastMusicVolume = this.gameState.musicVolume;
      this.gameMusic.setVolumeScale(this.gameState.musicVolume);
    }
    if (this.lastSfxVolume !== this.gameState.sfxVolume) {
      this.lastSfxVolume = this.gameState.sfxVolume;
      this.trainMovementAudio.setVolumeScale(this.gameState.sfxVolume);
      this.brakePressureAudio.setVolumeScale(this.gameState.sfxVolume);
      this.randomAmbientAudio.setVolumeScale(this.gameState.sfxVolume);
    }
  }

  private simulate(dt: number): void {
    this.applyAudioVolumes();
    const previousStatus = this.gameState.status;
    const input = this.inputManager.update(dt);

    if (this.gameState.status === GameStatus.Running) {
      this.gameState.elapsedTime += dt;
    }

    const timeOfDayHours = this.sceneSetup.dayNightSky.getTimeOfDayHours();
    this.gameState.timeOfDayHours = timeOfDayHours;

    if (
      this.gameState.status === GameStatus.Running ||
      this.gameState.status === GameStatus.Ready
    ) {
      this.gameState.expectedArrivalHours =
        (timeOfDayHours +
          (Math.max(
            0,
            this.gameState.expectedDuration - this.gameState.elapsedTime,
          ) /
            this.sceneSetup.dayNightSky.getDayCycleDurationSeconds()) *
            24) %
        24;
    }

    if (
      this.gameState.status !== GameStatus.Running &&
      this.gameState.status !== GameStatus.Ready
    ) {
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
    const safetyProbe = samples[Math.min(1, samples.length - 1)];
    const curvatureSafeSpeed =
      safetyProbe?.safeSpeed ?? this.config.minimap.safeSpeedMax;

    const comfort = this.comfortModel.update(
      {
        speed: train.speed,
        safeSpeed: curvatureSafeSpeed,
        accel: train.accel,
        jerk: train.jerk,
        elapsedTime: this.gameState.elapsedTime,
        expectedDuration: this.gameState.expectedDuration,
      },
      dt,
    );

    this.gameState.update({
      distance: train.distance,
      wrappedDistance,
      speed: train.speed,
      comfort: comfort,
      curvatureSafeSpeed: curvatureSafeSpeed,
    });

    if (
      previousStatus === GameStatus.Running &&
      this.gameState.status !== GameStatus.Running
    ) {
      this.showRunEndOverlay();
    }

    const controls =
      this.gameState.status === GameStatus.Running
        ? this.trainSim.getControls()
        : { throttle: 0, brake: 1 };

    const trainSpeedRatio = MathUtils.clamp(
      train.speed / this.config.train.maxSpeed,
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

    this.headlight.update(this.sceneSetup.dayNightSky.getNightFactor());
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
      pathPoints: this.trackSampler.samplePathAhead(
        this.gameState.wrappedDistance,
      ),
      status: this.gameState.getHudStatus(),
      statusMessage: this.gameState.getStatusMessage(),
      gameState: this.gameState,
    });
  }

  private initVisuals(): void {
    this.sceneSetup = new SceneSetup(
      this.preloadedAssets,
      this.gameState,
      this.config,
    );

    this.cameraRig = new CameraRig(
      this.sceneSetup.trackSpline,
      this.config.camera,
      this.container.clientWidth / this.container.clientHeight,
    );

    this.headlight = new TrainHeadlight(
      this.sceneSetup.scene,
      this.cameraRig.camera,
    );
    this.headlight.isEnabled = true;
  }

  private initUiControls(): void {
    this.introSplash = new IntroSplash(this.container);
    this.runEndOverlay = new RunEndOverlay(this.container);
    this.desktopControls = new DesktopControls({
      throttleRatePerSecond: this.config.train.throttleRatePerSecond,
      brakeRampSeconds: this.config.train.brakeRampSeconds,
    });
    this.inputManager = new InputManager(this.desktopControls);
    this.cabinChrome = new CabinChrome(this.container);
    this.throttleOverlay = new ThrottleOverlayCanvas(this.container, (value) =>
      this.desktopControls.setThrottle(value),
    );
    this.loginScreen = new LoginScreen(
      this.container,
      this.gameState,
      (level, userId, username) => this.startLevel(level, userId, username),
    );
    this.settingsScreen = new SettingsScreen(
      this.container,
      this.gameState,
      (level) => this.startLevel(level, this.gameState.userId, this.gameState.username),
    );
    this.hud = new HudController(
      this.container,
      (isDown) => this.desktopControls.setBrakeButtonDown(isDown),
      () => this.loginScreen.show(),
      () => this.settingsScreen.show(),
      this.gameState,
    );
  }

  private initAudio(): void {
    this.trainMovementAudio = new TrainMovementAudio({
      srcs: this.config.audio.movementTrackSrcs,
      maxTrainSpeed: this.config.train.maxSpeed,
      movementThreshold: this.config.audio.movementThreshold,
      minVolume: this.config.audio.minVolume,
      maxVolume: this.config.audio.maxVolume,
      releaseFadeSeconds: this.config.audio.movementReleaseFadeSeconds,
      preloadedHowls: this.preloadedAssets.movementHowls,
    });
    this.brakePressureAudio = new TrainMovementAudio({
      srcs: this.config.audio.brakeTrackSrcs,
      maxTrainSpeed: 1,
      movementThreshold: this.config.audio.brakePressureThreshold,
      minVolume: this.config.audio.brakeMinVolume,
      maxVolume: this.config.audio.brakeMaxVolume,
      releaseFadeSeconds: this.config.audio.brakeReleaseFadeSeconds,
      preloadedHowls: this.preloadedAssets.brakeHowls,
    });
    this.randomAmbientAudio = new RandomAmbientAudio({
      tracks: this.config.audio.ambientTrackSrcs,
      volume: this.config.audio.ambientVolume,
      minGapMs: this.config.audio.ambientMinGapMs,
      maxGapMs: this.config.audio.ambientMaxGapMs,
      preloadedHowls: this.preloadedAssets.ambientHowls,
    });
    this.gameMusic = new GameMusic({
      tracks: this.config.audio.musicTrackSrcs,
      volume: this.config.audio.musicVolume,
      gapMs: this.config.audio.musicGapMs,
      preloadedFirstTrackHowl: this.preloadedAssets.musicTrack1Howl,
    });
  }

  private initSimulation(): void {
    this.trainSim = new TrainSim(this.config.train);

    this.comfortModel = new ComfortModel(this.config.comfort);
    this.trackSampler = new TrackSampler(
      this.sceneSetup.trackSpline,
      this.config.minimap,
    );

    this.loop = new GameLoop(
      this.config.simDt,
      (dt) => this.simulate(dt),
      () => this.render(),
    );
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) return;

    this.renderer.resize(width, height);
    this.cameraRig?.onResize(width, height);
    this.throttleOverlay?.onResize(width, height);
  }

  private showRunEndOverlay(): void {
    if (this.gameState.status === GameStatus.Won) {
      const currentLevel = this.gameState.level;
      const nextLevel = currentLevel + 1;

      if (nextLevel > this.gameState.maxLevel) {
        this.gameState.update({ maxLevel: nextLevel });
        saveProgress(this.gameState.userId, this.gameState.username, nextLevel);
      }

      this.runEndOverlay.show({
        tone: "won",
        title: "Station Stop Complete",
        message: "You stopped before the platform end.",
        onRestart: () => this.restart(),
        onNextLevel: async () => {
          this.startLevel(
            nextLevel,
            this.gameState.userId,
            this.gameState.username,
          );
        },
        onLogin: async (username) => {
          const result = await login(username, this.gameState);
          if (result) {
            this.startLevel(result.level, result.userId, result.username);
          }
        },
        username: this.gameState.username,
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
      onRestart: () => this.restart(),
      onLogin: async (username) => {
        const result = await login(username, this.gameState);
        if (result) {
          this.startLevel(result.level, result.userId, result.username);
        }
      },
      username: this.gameState.username,
    });
  }
}
