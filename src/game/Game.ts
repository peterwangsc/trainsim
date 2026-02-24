import { MathUtils, Object3D, Scene, SpotLight, Vector3 } from "three";
import { CONFIG } from "./Config";
import { GameLoop } from "./GameLoop";
import { GameState } from "./GameState";
import { ComfortModel } from "../sim/ComfortModel";
import { TrackSampler } from "../sim/TrackSampler";
import { TrainSim } from "../sim/TrainSim";
import { DesktopControls } from "../input/DesktopControls";
import { InputManager } from "../input/InputManager";
import { CameraRig } from "../render/CameraRig";
import { DayNightSky } from "../render/DayNightSky";
import { Renderer } from "../render/Renderer";
import { createScene } from "../render/SceneSetup";
import { CabinChrome } from "../ui/CabinChrome";
import { HudController } from "../ui/HudController";
import { IntroSplash } from "../ui/IntroSplash";
import { RunEndOverlay } from "../ui/RunEndOverlay";
import { LoginScreen } from "../ui/LoginScreen";
import { ThrottleOverlayCanvas } from "../ui/ThrottleOverlayCanvas";
import { TrackGenerator } from "../world/Track/TrackGenerator";
import { TrackMeshBuilder } from "../world/Track/TrackMeshBuilder";
import { TrackSpline } from "../world/Track/TrackSpline";
import { TrackEndSet, type TrackEndLayout } from "../world/Track/TrackEndSet";
import { ForestLayer } from "../world/Foliage/ForestLayer";
import { GrassLayer } from "../world/Foliage/GrassLayer";
import { TerrainLayer } from "../world/Terrain/TerrainLayer";
import { BirdFlock } from "../world/Fauna/BirdFlock";
import type {
  CurvaturePreviewSample,
  MinimapPathPoint,
} from "../sim/TrackSampler";
import { TrainMovementAudio } from "../audio/TrainMovementAudio";
import { RandomAmbientAudio } from "../audio/RandomAmbientAudio";
import { GameMusic } from "../audio/GameMusic";
import type { CriticalPreloadedAssets } from "../loading/CriticalAssetPreloader";

type HudStatus = "running" | "won" | "failed";
type FailureReason = "COMFORT" | "BUMPER";
type GameOptions = {
  level: number;
  onRestartRequested?: () => void;
  onNextLevelRequested?: () => void;
  preloadedAssets: CriticalPreloadedAssets;
  onLogin?: (username: string, targetLevel: number) => void;
  onLogout?: () => void;
  username?: string | null;
};

type FrameMetrics = {
  speed: number;
  throttle: number;
  brake: number;
  distance: number;
  comfort: number;
  comfortRatio: number;
  safeSpeed: number;
  samples: CurvaturePreviewSample[];
  pathPoints: MinimapPathPoint[];
  status: HudStatus;
  statusMessage: string;
};

export class Game {
  private readonly renderer: Renderer;
  private readonly scene: Scene;
  private readonly dayNightSky: DayNightSky;
  private readonly terrainLayer: TerrainLayer;
  private readonly forestLayer: ForestLayer;
  private readonly grassLayer: GrassLayer;
  private readonly birdFlock: BirdFlock;
  private readonly trackSpline: TrackSpline;
  private readonly trackEndSet: TrackEndSet;
  private readonly trackEndLayout: TrackEndLayout;
  private readonly cameraRig: CameraRig;
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
  private readonly trainHeadlight: SpotLight;
  private readonly trainHeadlightTarget: Object3D;
  private readonly cameraForward = new Vector3();
  private readonly headlightAnchor = new Vector3();
  private readonly headlightTargetPosition = new Vector3();
  private toneMappingExposure = 1;
  private readonly onRestartRequested: () => void;
  private readonly onNextLevelRequested?: () => void;
  private readonly onLogin?: (username: string, targetLevel: number) => void;
  private readonly onLogout?: () => void;
  private readonly username: string | null;
  private readonly level: number;
  private readonly loginScreen: LoginScreen;

  private state = GameState.Ready;
  private failureReason: FailureReason | null = null;
  private wrappedDistance = 0;

  private frameMetrics: FrameMetrics = {
    speed: 0,
    throttle: 0,
    brake: 0,
    distance: 0,
    comfort: 100,
    comfortRatio: 1,
    safeSpeed: 0,
    samples: this.trackSamplerSamplesPlaceholder(),
    pathPoints: this.trackPreviewPathPlaceholder(),
    status: "running",
    statusMessage:
      "Drive to the terminal station and stop before the platform ends.",
  };

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
    this.frameMetrics.statusMessage = `Drive to Level ${this.level} terminal and stop before the platform ends.`;
    const preloadedAssets = options.preloadedAssets;

    const level = options.level;
    this.loginScreen = new LoginScreen(
      container,
      this.onLogin
        ? (username: string, targetLevel?: number | undefined) =>
            this.onLogin!(username, targetLevel ?? this.level)
        : undefined,
      this.username ? this.onLogout : undefined,
      this.username,
      level,
    );

    const trackConfig = {
      ...CONFIG.track,
      segmentCount: CONFIG.track.segmentCount + (level - 1) * 160,
      baseCurvaturePerMeter:
        CONFIG.track.baseCurvaturePerMeter * (1 + (level - 1) * 0.25),
      detailCurvaturePerMeter:
        CONFIG.track.detailCurvaturePerMeter * (1 + (level - 1) * 0.25),
    };
    const seed = CONFIG.seed + level - 1;

    const trackPoints = new TrackGenerator(seed, trackConfig).generate();

    this.trackSpline = new TrackSpline(trackPoints, { closed: false });
    const sceneSetup = createScene({
      cloudTexture: preloadedAssets.cloudTexture,
    });
    this.scene = sceneSetup.scene;
    this.dayNightSky = sceneSetup.dayNightSky;

    const trackMesh = new TrackMeshBuilder(
      this.trackSpline,
      trackConfig,
      preloadedAssets.dirtPathTexture,
    ).build();
    this.scene.add(trackMesh);
    this.trackEndSet = new TrackEndSet(this.trackSpline, {
      ...CONFIG.terminal,
      railGauge: CONFIG.track.railGauge,
    });
    this.trackEndLayout = this.trackEndSet.getLayout();
    this.scene.add(this.trackEndSet.root);
    this.terrainLayer = new TerrainLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.terrain,
      preloadedAssets.simplexNoiseTexture,
    );
    this.dayNightSky.setTerrainHeightSampler(
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
    );
    this.forestLayer = new ForestLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.forest,
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
      this.terrainLayer.getDistanceToTrack.bind(this.terrainLayer),
    );
    this.grassLayer = new GrassLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.grass,
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
      this.terrainLayer.getDistanceToTrack.bind(this.terrainLayer),
      preloadedAssets.simplexNoiseTexture,
      preloadedAssets.grassLeafTexture,
      preloadedAssets.grassAccentTexture,
    );
    this.dayNightSky.enableDirectionalFog();
    this.birdFlock = new BirdFlock(this.scene, CONFIG.birds);

    this.trainHeadlight = new SpotLight(
      "#ffe8c4",
      0,
      220,
      Math.PI * 0.16,
      0.36,
      1.6,
    );
    this.trainHeadlightTarget = new Object3D();
    this.trainHeadlight.castShadow = true;
    this.trainHeadlight.shadow.mapSize.set(512, 512);
    this.trainHeadlight.shadow.bias = -0.0002;
    this.trainHeadlight.shadow.normalBias = 0.018;
    this.trainHeadlight.shadow.camera.near = 0.8;
    this.trainHeadlight.shadow.camera.far = 240;
    this.trainHeadlight.visible = false;
    this.trainHeadlight.target = this.trainHeadlightTarget;
    this.scene.add(this.trainHeadlight);
    this.scene.add(this.trainHeadlightTarget);

    this.renderer = new Renderer(container);
    this.introSplash = new IntroSplash(container);
    this.runEndOverlay = new RunEndOverlay(container);

    this.cameraRig = new CameraRig(
      this.trackSpline,
      CONFIG.camera,
      container.clientWidth / container.clientHeight,
    );

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
    this.trackSampler = new TrackSampler(this.trackSpline, CONFIG.minimap);
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
    this.renderer.compile(this.scene, this.cameraRig.camera);
    this.simulate(0);
  }

  public start(): void {
    this.state = GameState.Running;
    this.failureReason = null;
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
    this.grassLayer.dispose();
    this.birdFlock.dispose();
    this.forestLayer.dispose();
    this.terrainLayer.dispose();
    this.dayNightSky.dispose();
    this.trainMovementAudio.dispose();
    this.brakePressureAudio.dispose();
    this.randomAmbientAudio.dispose();
    this.gameMusic.dispose();
    this.trackEndSet.dispose();
    this.scene.remove(this.trainHeadlight);
    this.scene.remove(this.trainHeadlightTarget);
    this.renderer.dispose();

    window.removeEventListener("resize", this.handleResizeBound);
    window.removeEventListener("keydown", this.handleDebugLookKeyDownBound);
    window.removeEventListener("mousemove", this.handleDebugLookMouseMoveBound);
    window.visualViewport?.removeEventListener("resize", this.handleResizeBound);
    window.visualViewport?.removeEventListener("scroll", this.handleResizeBound);
  }

  public restart(): void {
    this.loop.stop();

    this.failureReason = null;
    this.runEndOverlay.reset();
    this.cameraRig.reset();
    this.trainSim.reset();
    this.inputManager.reset();
    this.throttleOverlay.reset();
    this.comfortModel.reset();

    this.state = GameState.Running;
    this.loop.start();
  }

  private simulate(dt: number): void {
    const previousState = this.state;
    const input = this.inputManager.update(dt);

    if (this.state !== GameState.Running && this.state !== GameState.Ready) {
      this.trainSim.setControls({ throttle: 0, brake: 1 });
    } else {
      this.trainSim.setControls(input);
    }

    this.trainSim.update(dt);

    const train = this.trainSim.getState(dt);
    const trackLength = this.trackSpline.getLength();
    this.wrappedDistance = this.trackSpline.isClosed()
      ? train.distance % trackLength
      : Math.min(train.distance, trackLength);

    const samples = this.trackSampler.sampleAhead(this.wrappedDistance);
    const pathPoints = this.trackSampler.samplePathAhead(this.wrappedDistance);
    const safetyProbe = samples[Math.min(1, samples.length - 1)];
    const curvatureSafeSpeed =
      safetyProbe?.safeSpeed ?? CONFIG.minimap.safeSpeedMax;
    const terminalGuidanceSafeSpeed = this.computeTerminalGuidanceSafeSpeed(
      train.distance,
    );
    const hudSafeSpeed = Math.min(
      curvatureSafeSpeed,
      terminalGuidanceSafeSpeed,
    );

    const comfort = this.comfortModel.update(
      {
        speed: train.speed,
        safeSpeed: curvatureSafeSpeed,
        accel: train.accel,
        jerk: train.jerk,
      },
      dt,
    );

    if (this.state === GameState.Running) {
      if (train.distance >= this.trackEndLayout.bumperDistance) {
        this.state = GameState.Failed;
        this.failureReason = "BUMPER";
      } else if (this.isStoppedInStation(train.distance, train.speed)) {
        this.state = GameState.Won;
      } else if (comfort <= 0) {
        this.state = GameState.Failed;
        this.failureReason = "COMFORT";
      }
    }

    if (
      previousState === GameState.Running &&
      this.state !== GameState.Running
    ) {
      this.showRunEndOverlay();
    }

    const controls =
      this.state === GameState.Running
        ? this.trainSim.getControls()
        : { throttle: 0, brake: 1 };

    this.frameMetrics = {
      speed: train.speed,
      throttle: controls.throttle,
      brake: controls.brake,
      distance: train.distance,
      comfort,
      comfortRatio: MathUtils.clamp(comfort / CONFIG.comfort.max, 0, 1),
      safeSpeed: hudSafeSpeed,
      samples,
      pathPoints,
      status: this.getHudStatus(),
      statusMessage: this.getStatusMessage(train.distance),
    };

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

    this.cameraRig.update(this.wrappedDistance, train.speed, dt);
    this.dayNightSky.update(dt, this.cameraRig.camera);
    this.birdFlock.update(
      dt,
      this.cameraRig.camera,
      this.dayNightSky.getNightFactor(),
    );
    this.grassLayer.update(dt);

    const targetExposure = this.dayNightSky.getRecommendedExposure();
    this.toneMappingExposure = MathUtils.damp(
      this.toneMappingExposure,
      targetExposure,
      2.25,
      dt,
    );
    this.renderer.setToneMappingExposure(this.toneMappingExposure);
    this.updateTrainHeadlight();
  }

  private render(): void {
    this.throttleOverlay.update(this.frameMetrics.throttle);
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.hud.update(this.frameMetrics);
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

  private computeTerminalGuidanceSafeSpeed(distance: number): number {
    const distanceToStationEnd = Math.max(
      0,
      this.trackEndLayout.stationEndDistance - distance,
    );
    if (distanceToStationEnd <= 0) {
      return 0;
    }

    const desiredDecel = 1.15;
    const safeSpeed = Math.sqrt(2 * desiredDecel * distanceToStationEnd);
    return MathUtils.clamp(safeSpeed, 0, CONFIG.minimap.safeSpeedMax);
  }

  private isStoppedInStation(distance: number, speed: number): boolean {
    return (
      speed <= CONFIG.terminal.stopSpeedThreshold &&
      distance >= this.trackEndLayout.stationStartDistance &&
      distance <= this.trackEndLayout.stationEndDistance
    );
  }

  private showRunEndOverlay(): void {
    if (this.state === GameState.Won) {
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

    const isBumperImpact = this.failureReason === "BUMPER";
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

  private getHudStatus(): HudStatus {
    if (this.state === GameState.Won) {
      return "won";
    }
    if (this.state === GameState.Failed) {
      return "failed";
    }
    return "running";
  }

  private getStatusMessage(distance: number): string {
    if (this.state === GameState.Won) {
      return "Station stop complete. You win.";
    }

    if (this.state === GameState.Failed) {
      if (this.failureReason === "BUMPER") {
        return "Bumper impact. You lose.";
      }
      return "Ride comfort collapsed. You lose.";
    }

    const distanceToStationEnd =
      this.trackEndLayout.stationEndDistance - distance;
    if (distanceToStationEnd > 260) {
      return `Level ${this.level} terminal in ${Math.ceil(distanceToStationEnd)} m`;
    }
    if (distanceToStationEnd > 80) {
      return `Station ahead. Begin braking (${Math.ceil(distanceToStationEnd)} m).`;
    }
    if (distanceToStationEnd > 0) {
      return `Stop before platform end: ${Math.max(1, Math.ceil(distanceToStationEnd))} m`;
    }

    const distanceToBumper = this.trackEndLayout.bumperDistance - distance;
    if (distanceToBumper > 0) {
      return `Past station end. Bumper in ${Math.max(1, Math.ceil(distanceToBumper))} m`;
    }

    return "Bumper impact. You lose.";
  }

  private updateTrainHeadlight(): void {
    const camera = this.cameraRig.camera;
    const nightFactor = this.dayNightSky.getNightFactor();
    const lightFactor = MathUtils.smoothstep(nightFactor, 0.28, 0.76);

    camera.getWorldDirection(this.cameraForward);
    this.headlightAnchor
      .copy(camera.position)
      .addScaledVector(this.cameraForward, 3.5);
    this.headlightAnchor.y += 1.1;

    this.headlightTargetPosition
      .copy(camera.position)
      .addScaledVector(this.cameraForward, 54);
    this.headlightTargetPosition.y -= 1.4;

    this.trainHeadlight.position.copy(this.headlightAnchor);
    this.trainHeadlightTarget.position.copy(this.headlightTargetPosition);
    this.trainHeadlightTarget.updateMatrixWorld();

    this.trainHeadlight.intensity = 120 * lightFactor;
    this.trainHeadlight.distance = MathUtils.lerp(80, 220, lightFactor);
    this.trainHeadlight.castShadow = lightFactor > 0.22;
    this.trainHeadlight.visible = lightFactor > 0.01;
  }

  private trackSamplerSamplesPlaceholder(): CurvaturePreviewSample[] {
    return CONFIG.minimap.previewDistances.map((distanceAhead) => ({
      distanceAhead,
      curvature: 0,
      safeSpeed: CONFIG.minimap.safeSpeedMax,
      lateral: 0,
      forward: distanceAhead,
    }));
  }

  private trackPreviewPathPlaceholder(): MinimapPathPoint[] {
    const points: MinimapPathPoint[] = [];
    const lookAhead = Math.max(1, CONFIG.minimap.pathLookAheadDistance);
    const spacing = Math.max(0.5, CONFIG.minimap.pathSampleSpacing);

    for (
      let distanceAhead = 0;
      distanceAhead <= lookAhead;
      distanceAhead += spacing
    ) {
      points.push({ distanceAhead, lateral: 0, forward: distanceAhead });
    }

    return points;
  }
}
