import { Group, Scene } from "three";
import { CONFIG } from "../../game/Config";
import { GameState } from "../../game/GameState";
import { CriticalPreloadedAssets } from "../../loading/CriticalAssetPreloader";
import { TrackGenerator } from "./TrackGenerator";
import { TrackMeshBuilder } from "./TrackMeshBuilder";
import { TrackSpline } from "./TrackSpline";
import { TrackEndSet } from "./TrackEndSet";

export class TrackLayer {
  public readonly trackSpline!: TrackSpline;
  public trackGroup!: Group;
  public trackEndSet!: TrackEndSet;

  constructor(
    private readonly scene: Scene,
    private readonly config: typeof CONFIG,
    private readonly preloadedAssets: CriticalPreloadedAssets,
    private readonly gameState: GameState,
  ) {
    const trackConfig = this.generateTrackConfig();

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

  dispose(): void {
    this.scene.remove(this.trackGroup);
    this.trackEndSet.dispose();
  }

  private generateTrackConfig() {
    return {
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
  }
}
