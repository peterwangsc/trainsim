import {
  CylinderGeometry,
  Group,
  MathUtils,
  Scene,
  Texture,
  Vector3,
} from "three";
import { SeededRandom } from "../../util/SeededRandom";
import { TrackSpline } from "../Track/TrackSpline";
import {
  getSingleTreeFootprintRadius,
  SingleTreeFactory,
  SingleTreeSpecies,
  SingleTreeTrunkCollider,
} from "./SingleTree";
import { CriticalPreloadedAssets } from "../../loading/CriticalAssetPreloader";

export type ForestConfig = {
  treeSpacing: number;
  treeBandNear: number;
  treeBandFar: number;
  spawnChancePerSide: number;
  lateralJitter: number;
  forwardJitter: number;
  minHeightScale: number;
  maxHeightScale: number;
  trackTreeClearDistance: number;
  trackTreeFadeDistance: number;
};

export type TerrainHeightSampler = (x: number, z: number) => number;
export type TrackDistanceSampler = (x: number, z: number) => number;

type TreeTrunkColliderInstance = SingleTreeTrunkCollider & {
  x: number;
  z: number;
};

type TreeFootprint = {
  x: number;
  z: number;
  radius: number;
};

const SPECIES_BUCKET: SingleTreeSpecies[] = [
  "pine",
  "pine",
  "pine",
  "fir",
  "fir",
  "redwood",
];

const UP = new Vector3(0, 1, 0);
const TREE_ROOT_BURY_OFFSET = 0.75;
const TREE_FOOTPRINT_CLEARANCE = 0.2;

export class ForestLayer {
  readonly colliders: TreeTrunkColliderInstance[] = [];

  private readonly root = new Group();
  private readonly treeFactory: SingleTreeFactory;
  private readonly trunkGeometries: CylinderGeometry[] = [];
  private readonly treeFootprints: TreeFootprint[] = [];
  private readonly center = new Vector3();
  private readonly tangent = new Vector3();
  private readonly right = new Vector3();
  private readonly position = new Vector3();
  private readonly treeBarkTexture: Texture;
  private readonly pineFoliageTexture: Texture;

  constructor(
    private readonly scene: Scene,
    private readonly spline: TrackSpline,
    private readonly seed: number,
    private readonly config: ForestConfig,
    preloadedAssets: CriticalPreloadedAssets,
    private readonly sampleTerrainHeight?: TerrainHeightSampler,
    private readonly sampleTrackDistance?: TrackDistanceSampler,
  ) {
    this.treeBarkTexture = preloadedAssets.treeBarkTexture;
    this.pineFoliageTexture = preloadedAssets.pineFoliageTexture;
    this.root.name = "forest-layer";
    this.root.frustumCulled = false;
    this.scene.add(this.root);
    this.treeFactory = new SingleTreeFactory(
      this.treeBarkTexture,
      this.pineFoliageTexture,
    );
    this.generate();
  }

  dispose(): void {
    this.scene.remove(this.root);
    for (const geometry of this.trunkGeometries) {
      geometry.dispose();
    }
    this.treeFactory.dispose();
    this.treeFootprints.length = 0;
    this.colliders.length = 0;
  }

  private generate(): void {
    const rng = new SeededRandom(this.seed ^ 0x5f3759df);
    const trackLength = this.spline.getLength();

    for (
      let distance = 0;
      distance < trackLength;
      distance += this.config.treeSpacing
    ) {
      const trackDistance =
        distance +
        rng.range(-this.config.forwardJitter, this.config.forwardJitter);
      this.center.copy(this.spline.getPositionAtDistance(trackDistance));
      this.tangent.copy(this.spline.getTangentAtDistance(trackDistance));
      this.right.crossVectors(this.tangent, UP).normalize();

      this.trySpawnSide(rng, trackDistance, -1);
      this.trySpawnSide(rng, trackDistance, 1);
    }
  }

  private trySpawnSide(
    rng: SeededRandom,
    trackDistance: number,
    side: -1 | 1,
  ): void {
    if (rng.next() > this.config.spawnChancePerSide) {
      return;
    }

    const sideOffset =
      rng.range(this.config.treeBandNear, this.config.treeBandFar) +
      rng.range(-this.config.lateralJitter, this.config.lateralJitter);
    this.position
      .copy(this.center)
      .addScaledVector(this.right, sideOffset * side);

    const distanceToTrack = this.sampleTrackDistance
      ? this.sampleTrackDistance(this.position.x, this.position.z)
      : Math.abs(sideOffset);
    const trackBlend = MathUtils.smoothstep(
      distanceToTrack,
      this.config.trackTreeClearDistance,
      this.config.trackTreeFadeDistance,
    );
    if (trackBlend <= 0.001) {
      return;
    }

    this.position.y = this.sampleTerrainHeight
      ? this.sampleTerrainHeight(this.position.x, this.position.z)
      : 0;
    this.position.y -= TREE_ROOT_BURY_OFFSET;

    const species = this.pickSpecies(rng);
    let heightScale =
      rng.range(this.config.minHeightScale, this.config.maxHeightScale) *
      trackBlend;

    if (species === "redwood") {
      heightScale *= rng.range(1.05, 1.25);
    } else if (species === "fir") {
      heightScale *= rng.range(0.92, 1.08);
    }

    const variationSeed =
      this.seed + trackDistance * 31.7 + side * 97.3 + rng.range(-2000, 2000);
    const footprintRadius = getSingleTreeFootprintRadius(
      heightScale,
      species,
      variationSeed,
    );

    if (
      this.overlapsExistingTree(
        this.position.x,
        this.position.z,
        footprintRadius,
      )
    ) {
      return;
    }

    const tree = this.treeFactory.createTree({
      position: [this.position.x, this.position.y, this.position.z],
      species,
      heightScale,
      variationSeed,
    });

    this.root.add(tree.group);
    this.trunkGeometries.push(tree.trunkGeometry);
    this.colliders.push({
      ...tree.trunkCollider,
      x: this.position.x,
      z: this.position.z,
    });
    this.treeFootprints.push({
      x: this.position.x,
      z: this.position.z,
      radius: footprintRadius,
    });
  }

  private pickSpecies(rng: SeededRandom): SingleTreeSpecies {
    const index = Math.floor(rng.range(0, SPECIES_BUCKET.length));
    return SPECIES_BUCKET[Math.min(index, SPECIES_BUCKET.length - 1)];
  }

  private overlapsExistingTree(
    x: number,
    z: number,
    candidateRadius: number,
  ): boolean {
    for (const tree of this.treeFootprints) {
      const dx = x - tree.x;
      const dz = z - tree.z;
      const minDistance =
        candidateRadius + tree.radius + TREE_FOOTPRINT_CLEARANCE;

      if (dx * dx + dz * dz < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }
}
