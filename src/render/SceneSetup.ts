import { Scene, Group } from "three";
import { CONFIG } from "../game/Config";
import { DayNightSky } from "./DayNightSky";
import { TerrainLayer } from "../world/Terrain/TerrainLayer";
import { ForestLayer } from "../world/Foliage/ForestLayer";
import { GrassLayer } from "../world/Foliage/GrassLayer";
import { BirdFlock } from "../world/Fauna/BirdFlock";
import { TrackGenerator } from "../world/Track/TrackGenerator";
import { TrackSpline } from "../world/Track/TrackSpline";
import { TrackMeshBuilder } from "../world/Track/TrackMeshBuilder";
import { TrackEndSet } from "../world/Track/TrackEndSet";
import type { CriticalPreloadedAssets } from "../loading/CriticalAssetPreloader";
import type { PerspectiveCamera } from "three";
import { GameState } from "../game/GameState";

export class SceneSetup {
  public readonly scene: Scene;
  public dayNightSky!: DayNightSky;
  public terrainLayer!: TerrainLayer;
  public forestLayer!: ForestLayer;
  public grassLayer!: GrassLayer;
  public birdFlock!: BirdFlock;
  public trackEndSet!: TrackEndSet;
  public trackSpline!: TrackSpline;
  public trackGroup!: Group;
  private gameState!: GameState;

  constructor(
    private readonly preloadedAssets: CriticalPreloadedAssets,
    gameState: GameState,
    private readonly config: typeof CONFIG,
  ) {
    this.scene = new Scene();
    this.gameState = gameState;
    this.buildScene();
  }

  rebuildScene(gameState: GameState): void {
    this.grassLayer.dispose();
    this.forestLayer.dispose();
    this.terrainLayer.dispose();
    this.trackEndSet.dispose();
    this.scene.remove(this.trackGroup);
    this.gameState = gameState;
    this.buildTrack();
    this.buildTerrain();
    this.dayNightSky.setTerrainHeightSampler(
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
    );
    this.buildForest();
    this.buildGrass();
  }

  update(dt: number, camera: PerspectiveCamera): void {
    this.dayNightSky.update(dt, camera);
    this.birdFlock.update(dt, camera, this.dayNightSky.getNightFactor());
    this.grassLayer.update(dt);
  }

  dispose(): void {
    this.grassLayer.dispose();
    this.birdFlock.dispose();
    this.forestLayer.dispose();
    this.terrainLayer.dispose();
    this.dayNightSky.dispose();
    this.trackEndSet.dispose();
    this.scene.remove(this.trackGroup);
  }

  private buildScene(): void {
    this.buildSky();
    this.buildTrack();
    this.buildTerrain();
    this.dayNightSky.setTerrainHeightSampler(
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
    );
    this.buildForest();
    this.buildGrass();
    this.buildBirdFlock();
    this.dayNightSky.enableDirectionalFog();
  }

  private buildSky(): void {
    this.dayNightSky = new DayNightSky(this.scene, {
      cloudTexture: this.preloadedAssets.cloudTexture,
    });
  }

  private buildTrack(): void {
    const trackConfig = {
      ...this.config.track,
      segmentCount:
        this.config.track.segmentCount + (this.gameState.level - 1) * 50,
      baseCurvaturePerMeter:
        this.config.track.baseCurvaturePerMeter *
        (1 + (this.gameState.level - 1) * 0.05),
      detailCurvaturePerMeter:
        this.config.track.detailCurvaturePerMeter *
        (1 + (this.gameState.level - 1) * 0.05),
    };

    const trackPoints = new TrackGenerator(
      trackConfig,
      this.config.seed,
      this.gameState,
    ).generate();
    this.trackSpline = new TrackSpline(trackPoints, { closed: false });

    this.trackGroup = new TrackMeshBuilder(
      this.trackSpline,
      trackConfig,
      this.preloadedAssets,
    ).build();
    this.scene.add(this.trackGroup);

    this.trackEndSet = new TrackEndSet(
      this.trackSpline,
      {
        ...this.config.terminal,
        railGauge: this.config.track.railGauge,
      },
      this.preloadedAssets,
    );
    this.scene.add(this.trackEndSet.root);
  }

  private buildTerrain(): void {
    this.terrainLayer = new TerrainLayer(
      this.scene,
      this.trackSpline,
      this.config.seed,
      this.config.terrain,
      this.preloadedAssets,
    );
  }

  private buildForest(): void {
    this.forestLayer = new ForestLayer(
      this.scene,
      this.trackSpline,
      this.config.seed,
      this.config.forest,
      this.preloadedAssets,
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
      this.terrainLayer.getDistanceToTrack.bind(this.terrainLayer),
    );
  }

  private buildGrass(): void {
    this.grassLayer = new GrassLayer(
      this.scene,
      this.trackSpline,
      this.config.seed,
      this.config.grass,
      this.preloadedAssets,
      this.terrainLayer.getHeightAt.bind(this.terrainLayer),
      this.terrainLayer.getDistanceToTrack.bind(this.terrainLayer),
    );
  }

  private buildBirdFlock(): void {
    this.birdFlock = new BirdFlock(this.scene, this.config.birds);
  }
}
