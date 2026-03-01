import { Scene, Group } from "three";
import { CONFIG } from "../game/Config";
import { DayNightSky } from "./DayNightSky";
import { TerrainLayer } from "../world/Terrain/TerrainLayer";
import { ForestLayer } from "../world/Foliage/ForestLayer";
import { GrassLayer } from "../world/Foliage/GrassLayer";
import { BirdFlock } from "../world/Fauna/BirdFlock";
import { TrackLayer } from "../world/Track/TrackLayer";
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
  public trackLayer!: TrackLayer;
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
    this.trackLayer.dispose();
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
    this.trackLayer.dispose();
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
    this.trackLayer = new TrackLayer(
      this.scene,
      this.config,
      this.preloadedAssets,
      this.gameState,
    );
  }

  private buildTerrain(): void {
    this.terrainLayer = new TerrainLayer(
      this.scene,
      this.trackLayer.trackSpline,
      this.config.seed,
      this.config.terrain,
      this.preloadedAssets,
    );
  }

  private buildForest(): void {
    this.forestLayer = new ForestLayer(
      this.scene,
      this.trackLayer.trackSpline,
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
      this.trackLayer.trackSpline,
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
