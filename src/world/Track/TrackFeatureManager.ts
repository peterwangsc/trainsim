import { Scene } from "three";
import { TrackFeature } from "./TrackFeature";

export class TrackFeatureManager {
  private readonly features: TrackFeature[] = [];

  constructor(private readonly scene: Scene) {}

  add(feature: TrackFeature): void {
    this.features.push(feature);
    this.scene.add(feature.root);
  }

  updateAll(trainDistance: number, dt: number): void {
    for (const feature of this.features) {
      feature.update(trainDistance, dt);
    }
  }

  getActiveZones(trainDistance: number): TrackFeature[] {
    return this.features.filter(
      (f) =>
        f.endDistance !== undefined &&
        trainDistance >= f.startDistance &&
        trainDistance <= f.endDistance,
    );
  }

  getUpcoming(trainDistance: number, lookahead: number): TrackFeature[] {
    return this.features.filter(
      (f) =>
        f.startDistance > trainDistance &&
        f.startDistance <= trainDistance + lookahead,
    );
  }

  disposeAll(): void {
    for (const feature of this.features) {
      feature.dispose();
    }
    this.features.length = 0;
  }
}
