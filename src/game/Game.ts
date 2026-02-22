import { MathUtils, Object3D, Scene, SpotLight, Vector3 } from 'three';
import { CONFIG } from './Config';
import { GameLoop } from './GameLoop';
import { GameState } from './GameState';
import { ComfortModel } from '../sim/ComfortModel';
import { TrackSampler } from '../sim/TrackSampler';
import { TrainSim } from '../sim/TrainSim';
import { DesktopControls } from '../input/DesktopControls';
import { InputManager } from '../input/InputManager';
import { CameraRig } from '../render/CameraRig';
import { DayNightSky } from '../render/DayNightSky';
import { Renderer } from '../render/Renderer';
import { createScene } from '../render/SceneSetup';
import { CabinChrome } from '../ui/CabinChrome';
import { HudController } from '../ui/HudController';
import { ThrottleOverlayCanvas } from '../ui/ThrottleOverlayCanvas';
import { TrackGenerator } from '../world/Track/TrackGenerator';
import { TrackMeshBuilder } from '../world/Track/TrackMeshBuilder';
import { TrackSpline } from '../world/Track/TrackSpline';
import { ForestLayer } from '../world/Foliage/ForestLayer';
import { GrassLayer } from '../world/Foliage/GrassLayer';
import { TerrainLayer } from '../world/Terrain/TerrainLayer';
import { BirdFlock } from '../world/Fauna/BirdFlock';
import type { CurvaturePreviewSample, MinimapPathPoint } from '../sim/TrackSampler';
import { TrainMovementAudio } from '../audio/TrainMovementAudio';
import { RandomAmbientAudio } from '../audio/RandomAmbientAudio';

type FrameMetrics = {
  speed: number;
  throttle: number;
  brake: number;
  distance: number;
  comfort: number;
  safeSpeed: number;
  samples: CurvaturePreviewSample[];
  pathPoints: MinimapPathPoint[];
  failed: boolean;
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
  private readonly cameraRig: CameraRig;
  private readonly inputManager: InputManager;
  private readonly cabinChrome: CabinChrome;
  private readonly throttleOverlay: ThrottleOverlayCanvas;
  private readonly trainSim: TrainSim;
  private readonly comfortModel: ComfortModel;
  private readonly trackSampler: TrackSampler;
  private readonly hud: HudController;
  private readonly loop: GameLoop;
  private readonly trainMovementAudio: TrainMovementAudio;
  private readonly brakePressureAudio: TrainMovementAudio;
  private readonly randomAmbientAudio: RandomAmbientAudio;
  private readonly trainHeadlight: SpotLight;
  private readonly trainHeadlightTarget: Object3D;
  private readonly cameraForward = new Vector3();
  private readonly headlightAnchor = new Vector3();
  private readonly headlightTargetPosition = new Vector3();
  private toneMappingExposure = 1;

  private state = GameState.Ready;
  private wrappedDistance = 0;

  private frameMetrics: FrameMetrics = {
    speed: 0,
    throttle: 0,
    brake: 0,
    distance: 0,
    comfort: 100,
    safeSpeed: 0,
    samples: this.trackSamplerSamplesPlaceholder(),
    pathPoints: this.trackPreviewPathPlaceholder(),
    failed: false
  };

  constructor(private readonly container: HTMLElement) {
    const trackPoints = new TrackGenerator(CONFIG.seed, CONFIG.track).generate();

    this.trackSpline = new TrackSpline(trackPoints, { closed: false });
    const sceneSetup = createScene();
    this.scene = sceneSetup.scene;
    this.dayNightSky = sceneSetup.dayNightSky;

    const trackMesh = new TrackMeshBuilder(this.trackSpline, CONFIG.track).build();
    this.scene.add(trackMesh);
    this.terrainLayer = new TerrainLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.terrain
    );
    this.forestLayer = new ForestLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.forest,
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
      this.terrainLayer.getDistanceToTrack.bind(this.terrainLayer)
    );
    this.grassLayer = new GrassLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.grass,
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
      this.terrainLayer.getDistanceToTrack.bind(this.terrainLayer)
    );
    this.birdFlock = new BirdFlock(this.scene, CONFIG.birds);

    this.trainHeadlight = new SpotLight(
      '#ffe8c4',
      0,
      220,
      Math.PI * 0.16,
      0.36,
      1.6
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

    this.cameraRig = new CameraRig(
      this.trackSpline,
      CONFIG.camera,
      container.clientWidth / container.clientHeight
    );

    const desktopControls = new DesktopControls({
      throttleRatePerSecond: CONFIG.train.throttleRatePerSecond,
      brakeRampSeconds: CONFIG.train.brakeRampSeconds
    });

    this.inputManager = new InputManager(desktopControls);
    this.cabinChrome = new CabinChrome(container);
    this.throttleOverlay = new ThrottleOverlayCanvas(
      container,
      (value) => {
        desktopControls.setThrottle(value);
      }
    );

    this.trainSim = new TrainSim(CONFIG.train);
    this.trainMovementAudio = new TrainMovementAudio({
      src: CONFIG.audio.movementTrackSrc,
      maxTrainSpeed: CONFIG.train.maxSpeed,
      movementThreshold: CONFIG.audio.movementThreshold,
      minPlaybackRate: CONFIG.audio.minPlaybackRate,
      maxPlaybackRate: CONFIG.audio.maxPlaybackRate,
      minVolume: CONFIG.audio.minVolume,
      maxVolume: CONFIG.audio.maxVolume
    });
    this.brakePressureAudio = new TrainMovementAudio({
      src: CONFIG.audio.brakeTrackSrc,
      maxTrainSpeed: 1,
      movementThreshold: CONFIG.audio.brakePressureThreshold,
      minPlaybackRate: 1,
      maxPlaybackRate: 1,
      minVolume: CONFIG.audio.brakeMinVolume,
      maxVolume: CONFIG.audio.brakeMaxVolume,
      releaseFadeSeconds: CONFIG.audio.brakeReleaseFadeSeconds
    });
    this.randomAmbientAudio = new RandomAmbientAudio({
      tracks: CONFIG.audio.ambientTrackSrcs,
      volume: CONFIG.audio.ambientVolume
    });
    this.comfortModel = new ComfortModel(CONFIG.comfort);
    this.trackSampler = new TrackSampler(this.trackSpline, CONFIG.minimap);
    this.hud = new HudController(container, (isDown) => {
      desktopControls.setBrakeButtonDown(isDown);
    });

    this.loop = new GameLoop(CONFIG.simDt, this.simulate, this.render);

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  start(): void {
    this.state = GameState.Running;
    this.randomAmbientAudio.start();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.cabinChrome.dispose();
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
    this.scene.remove(this.trainHeadlight);
    this.scene.remove(this.trainHeadlightTarget);
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }

  private simulate = (dt: number): void => {
    const input = this.inputManager.update(dt);

    if (this.state === GameState.Failed) {
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
    const safeSpeed = safetyProbe?.safeSpeed ?? CONFIG.minimap.safeSpeedMax;

    const comfort = this.comfortModel.update(
      {
        speed: train.speed,
        safeSpeed,
        accel: train.accel,
        jerk: train.jerk
      },
      dt
    );

    if (comfort <= 0) {
      this.state = GameState.Failed;
    }

    const controls = this.trainSim.getControls();

    this.frameMetrics = {
      speed: train.speed,
      throttle: controls.throttle,
      brake: controls.brake,
      distance: train.distance,
      comfort,
      safeSpeed,
      samples,
      pathPoints,
      failed: this.state === GameState.Failed
    };
    const trainSpeedRatio = MathUtils.clamp(train.speed / CONFIG.train.maxSpeed, 0, 1);
    const brakeAudioDrive = controls.brake * trainSpeedRatio;
    this.trainMovementAudio.update(train.speed, dt);
    this.brakePressureAudio.update(brakeAudioDrive, dt);

    this.cameraRig.update(this.wrappedDistance, train.speed, dt);
    this.dayNightSky.update(dt, this.cameraRig.camera);
    this.birdFlock.update(dt, this.cameraRig.camera, this.dayNightSky.getNightFactor());
    this.grassLayer.update(dt);
    const targetExposure = this.dayNightSky.getRecommendedExposure();
    this.toneMappingExposure = MathUtils.damp(
      this.toneMappingExposure,
      targetExposure,
      2.25,
      dt
    );
    this.renderer.setToneMappingExposure(this.toneMappingExposure);
    this.updateTrainHeadlight();
  };

  private render = (): void => {
    this.throttleOverlay.update(this.frameMetrics.throttle);
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.hud.update(this.frameMetrics);
  };

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    this.renderer.resize(width, height);
    this.cameraRig.onResize(width, height);
    this.throttleOverlay.onResize(width);
  };

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
      forward: distanceAhead
    }));
  }

  private trackPreviewPathPlaceholder(): MinimapPathPoint[] {
    const points: MinimapPathPoint[] = [];
    const lookAhead = Math.max(1, CONFIG.minimap.pathLookAheadDistance);
    const spacing = Math.max(0.5, CONFIG.minimap.pathSampleSpacing);

    for (let distanceAhead = 0; distanceAhead <= lookAhead; distanceAhead += spacing) {
      points.push({ distanceAhead, lateral: 0, forward: distanceAhead });
    }

    return points;
  }
}
