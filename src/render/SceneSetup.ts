import { Scene, Vector3 } from "three";
import { CONFIG } from "../game/Config";
import { DayNightSky } from "./DayNightSky";
import { TerrainLayer } from "../world/Terrain/TerrainLayer";
import { ForestLayer } from "../world/Foliage/ForestLayer";
import { GrassLayer } from "../world/Foliage/GrassLayer";
import { BirdFlock } from "../world/Fauna/BirdFlock";
import { TrackSpline } from "../world/Track/TrackSpline";
import { TrackMeshBuilder } from "../world/Track/TrackMeshBuilder";
import { TrackEndSet } from "../world/Track/TrackEndSet";
import type { CriticalPreloadedAssets } from "../loading/CriticalAssetPreloader";
import type { PerspectiveCamera } from "three";

export class SceneSetup {
  public readonly scene: Scene;
  public readonly dayNightSky: DayNightSky;
  public readonly terrainLayer: TerrainLayer;
  public readonly forestLayer: ForestLayer;
  public readonly grassLayer: GrassLayer;
  public readonly birdFlock: BirdFlock;
  public readonly trackEndSet: TrackEndSet;

  constructor(
    public readonly trackSpline: TrackSpline,
    preloadedAssets: CriticalPreloadedAssets,
    level: number,
  ) {
    this.scene = new Scene();
    this.dayNightSky = new DayNightSky(this.scene, {
      cloudTexture: preloadedAssets.cloudTexture,
    });

    const trackConfig = {
      ...CONFIG.track,
      segmentCount: CONFIG.track.segmentCount + (level - 1) * 160,
      baseCurvaturePerMeter:
        CONFIG.track.baseCurvaturePerMeter * (1 + (level - 1) * 0.25),
      detailCurvaturePerMeter:
        CONFIG.track.detailCurvaturePerMeter * (1 + (level - 1) * 0.25),
    };

    const trackMesh = new TrackMeshBuilder(
      this.trackSpline,
      trackConfig,
      preloadedAssets.dirtPathTexture,
      preloadedAssets.woodenPlankTexture,
      preloadedAssets.railTexture,
    ).build();
    this.scene.add(trackMesh);

    this.trackEndSet = new TrackEndSet(
      this.trackSpline,
      {
        ...CONFIG.terminal,
        railGauge: CONFIG.track.railGauge,
      },
      preloadedAssets.dirtPathTexture,
      preloadedAssets.darkBrushedMetalTexture,
      preloadedAssets.knurledMetalTexture,
      preloadedAssets.concretePlatformTexture,
      preloadedAssets.corrugatedMetalRoofTexture,
      preloadedAssets.redPaintedMetalTexture,
      preloadedAssets.brickStationWallTexture,
    );
    this.scene.add(this.trackEndSet.root);

    this.terrainLayer = new TerrainLayer(
      this.scene,
      this.trackSpline,
      CONFIG.seed,
      CONFIG.terrain,
      preloadedAssets.simplexNoiseTexture,
      preloadedAssets.hillyGrassTexture,
      preloadedAssets.rockyMountainTexture,
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
      preloadedAssets.treeBarkTexture,
      preloadedAssets.pineFoliageTexture,
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
  }

  update(dt: number, camera: PerspectiveCamera): void {
    this.dayNightSky.update(dt, camera);
    this.birdFlock.update(
      dt,
      camera,
      this.dayNightSky.getNightFactor(),
    );
    this.grassLayer.update(dt);
  }

  dispose(): void {
    this.grassLayer.dispose();
    this.birdFlock.dispose();
    this.forestLayer.dispose();
    this.terrainLayer.dispose();
    this.dayNightSky.dispose();
    this.trackEndSet.dispose();
  }
}
