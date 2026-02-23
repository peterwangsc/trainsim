import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { TrackFeature, type EnvironmentEffect } from "../Track/TrackFeature";
import { TrackSpline } from "../Track/TrackSpline";
import { placeAlongTrack } from "../Track/TrackPlacement";

export type TunnelConfig = {
  startDistance: number;
  length: number;
  archInnerWidth: number;
  archInnerHeight: number;
  wallThickness: number;
  archRingSpacing: number;
};

const CONCRETE_COLOR = "#8a8880";
const CONCRETE_ROUGHNESS = 0.88;
const CONCRETE_METALNESS = 0.04;

// Module-level scratch objects — reused across all instance placement loops
const _dummy = new Object3D();
const _pos = new Vector3();
const _quat = new Quaternion();
const _quatB = new Quaternion(); // scratch for flipped quaternion
const _scale = new Vector3(1, 1, 1);
const _scaleB = new Vector3(); // scratch for non-uniform scale
const _mat = new Matrix4();
// 180° rotation around local X → flips a cone so its apex (+Y) points downward in world space
const _FLIP_X180 = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);

// Terrain colour palette (matching TerrainLayer's lowColor/midColor/rockColor/highColor)
const TERRAIN_PALETTE = {
  low:  [0x4f / 255, 0x6b / 255, 0x3f / 255] as [number, number, number],
  mid:  [0x7e / 255, 0x8f / 255, 0x62 / 255] as [number, number, number],
  rock: [0x8b / 255, 0x84 / 255, 0x70 / 255] as [number, number, number],
  high: [0xa9 / 255, 0xa8 / 255, 0x88 / 255] as [number, number, number],
};

export class TunnelFeature extends TrackFeature {
  private readonly disposableGeometries: BufferGeometry[] = [];
  private readonly disposableMaterials: Material[] = [];

  constructor(spline: TrackSpline, config: TunnelConfig) {
    super(spline, config.startDistance, config.startDistance + config.length);
    this.root.name = "tunnel-feature";
    this.build(config);
  }

  getEnvironmentEffect(t: number): EnvironmentEffect {
    const inside = Math.min(t / 0.15, 1) * Math.min((1 - t) / 0.15, 1);
    return { ambientMultiplier: 1 - 0.72 * inside };
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const geo of this.disposableGeometries) geo.dispose();
    for (const mat of this.disposableMaterials) mat.dispose();
  }

  private build(config: TunnelConfig): void {
    const endDistance = config.startDistance + config.length;
    this.buildPortal(config, config.startDistance, false);
    this.buildPortal(config, endDistance, true);
    this.buildArchRings(config);
    this.buildMountain(config);
    this.buildRockyInterior(config);
  }

  // ─── Portal frames ────────────────────────────────────────────────────────

  private buildPortal(
    config: TunnelConfig,
    distance: number,
    faceBackward: boolean,
  ): void {
    const { archInnerWidth, archInnerHeight, wallThickness } = config;
    const portalDepth = 0.85;
    const material = this.createMaterial(
      new MeshStandardMaterial({
        color: CONCRETE_COLOR,
        roughness: CONCRETE_ROUGHNESS,
        metalness: CONCRETE_METALNESS,
      }),
    );

    const pillarHeight = archInnerHeight;
    const pillarGeo = this.createGeometry(
      new BoxGeometry(wallThickness, pillarHeight, portalDepth),
    );
    const lintelGeo = this.createGeometry(
      new BoxGeometry(archInnerWidth + wallThickness * 2, wallThickness, portalDepth),
    );

    const group = new Group();

    for (const side of [-1, 1] as const) {
      const pillar = new Mesh(pillarGeo, material);
      pillar.position.set(side * (archInnerWidth * 0.5 + wallThickness * 0.5), pillarHeight * 0.5, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);
    }

    const lintel = new Mesh(lintelGeo, material);
    lintel.position.set(0, archInnerHeight + wallThickness * 0.5, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);

    placeAlongTrack(group, this.spline, distance, 0, 0, faceBackward);
    this.root.add(group);
  }

  // ─── Interior arch rings ──────────────────────────────────────────────────

  private buildArchRings(config: TunnelConfig): void {
    const { startDistance, length, archInnerWidth, archInnerHeight, wallThickness, archRingSpacing } = config;
    const endDistance = startDistance + length;
    const ringDepth = 0.45;
    const pillarHeight = archInnerHeight;

    const legGeo = this.createGeometry(
      new BoxGeometry(wallThickness, pillarHeight, ringDepth),
    );
    const topGeo = this.createGeometry(
      new BoxGeometry(archInnerWidth + wallThickness * 2, wallThickness, ringDepth),
    );
    const material = this.createMaterial(
      new MeshStandardMaterial({
        color: CONCRETE_COLOR,
        roughness: CONCRETE_ROUGHNESS,
        metalness: CONCRETE_METALNESS,
      }),
    );

    const ringPositions: number[] = [];
    for (let d = startDistance + archRingSpacing; d < endDistance - archRingSpacing * 0.5; d += archRingSpacing) {
      ringPositions.push(d);
    }
    if (ringPositions.length === 0) return;

    const legMesh = new InstancedMesh(legGeo, material, ringPositions.length * 2);
    legMesh.receiveShadow = true;
    legMesh.castShadow = false;
    const topMesh = new InstancedMesh(topGeo, material, ringPositions.length);
    topMesh.receiveShadow = true;
    topMesh.castShadow = false;

    ringPositions.forEach((distance, ringIndex) => {
      placeAlongTrack(_dummy, this.spline, distance, 0, 0, false);
      _dummy.updateMatrixWorld(true);
      _dummy.getWorldPosition(_pos);
      _dummy.getWorldQuaternion(_quat);

      for (const side of [-1, 1] as const) {
        const legOffset = new Vector3(side * (archInnerWidth * 0.5 + wallThickness * 0.5), pillarHeight * 0.5, 0);
        legOffset.applyQuaternion(_quat);
        _mat.compose(_pos.clone().add(legOffset), _quat, _scale);
        legMesh.setMatrixAt(ringIndex * 2 + (side === -1 ? 0 : 1), _mat);
      }

      const topOffset = new Vector3(0, archInnerHeight + wallThickness * 0.5, 0);
      topOffset.applyQuaternion(_quat);
      _mat.compose(_pos.clone().add(topOffset), _quat, _scale);
      topMesh.setMatrixAt(ringIndex, _mat);
    });

    legMesh.instanceMatrix.needsUpdate = true;
    topMesh.instanceMatrix.needsUpdate = true;
    this.root.add(legMesh);
    this.root.add(topMesh);
  }

  // ─── Mountain ─────────────────────────────────────────────────────────────

  private buildMountain(config: TunnelConfig): void {
    const midDistance = config.startDistance + config.length * 0.5;

    // Sample world position at the tunnel midpoint (track level = mountain base)
    placeAlongTrack(_dummy, this.spline, midDistance, 0, 0, false);
    _dummy.updateMatrixWorld(true);
    _dummy.getWorldPosition(_pos);
    const baseX = _pos.x;
    const baseY = _pos.y;
    const baseZ = _pos.z;

    // Main peak — wide enough to visually envelop the full tunnel bore
    const mountainRadius = config.length * 0.72; // ≈ 108 m for default length 150
    const mountainHeight = 58;

    const terrainMat = this.createMaterial(
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.02 }),
    );

    const mainGeo = this.createGeometry(new ConeGeometry(mountainRadius, mountainHeight, 20, 6));
    this.applyTerrainVertexColors(mainGeo, mountainHeight);
    const mainMesh = new Mesh(mainGeo, terrainMat);
    mainMesh.position.set(baseX, baseY + mountainHeight * 0.5, baseZ);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    this.root.add(mainMesh);

    // Secondary shoulder — offset laterally for a more natural silhouette
    const shoulderRadius = mountainRadius * 0.52;
    const shoulderHeight = mountainHeight * 0.68;
    placeAlongTrack(_dummy, this.spline, midDistance, mountainRadius * 0.42, 0, false);
    _dummy.updateMatrixWorld(true);
    _dummy.getWorldPosition(_pos);

    const shoulderGeo = this.createGeometry(new ConeGeometry(shoulderRadius, shoulderHeight, 14, 4));
    this.applyTerrainVertexColors(shoulderGeo, shoulderHeight);
    const shoulderMesh = new Mesh(shoulderGeo, terrainMat);
    shoulderMesh.position.set(_pos.x, baseY + shoulderHeight * 0.5 - 6, _pos.z);
    shoulderMesh.castShadow = true;
    shoulderMesh.receiveShadow = false;
    this.root.add(shoulderMesh);
  }

  /**
   * Writes per-vertex RGB colours to `geo` based on each vertex's local Y
   * (0 at cone base, 1 at apex), matching TerrainLayer's elevation colour ramp.
   */
  private applyTerrainVertexColors(geo: BufferGeometry, height: number): void {
    const positions = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const { low, mid, rock, high } = TERRAIN_PALETTE;

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i); // range [-height/2, +height/2]
      // Add slight per-vertex noise for a rougher look
      const noise = this.hash(i * 7.3 + positions.getX(i) * 3.1) * 0.14 - 0.07;
      const e = Math.max(0, Math.min(1, (y + height * 0.5) / height + noise));

      let r: number, g: number, b: number;
      if (e < 0.30) {
        const t = e / 0.30;
        r = low[0] + (mid[0] - low[0]) * t;
        g = low[1] + (mid[1] - low[1]) * t;
        b = low[2] + (mid[2] - low[2]) * t;
      } else if (e < 0.65) {
        const t = (e - 0.30) / 0.35;
        r = mid[0] + (rock[0] - mid[0]) * t;
        g = mid[1] + (rock[1] - mid[1]) * t;
        b = mid[2] + (rock[2] - mid[2]) * t;
      } else {
        const t = Math.min((e - 0.65) / 0.35, 1);
        r = rock[0] + (high[0] - rock[0]) * t;
        g = rock[1] + (high[1] - rock[1]) * t;
        b = rock[2] + (high[2] - rock[2]) * t;
      }

      colors[i * 3]     = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute("color", new BufferAttribute(colors, 3));
  }

  // ─── Rocky interior ───────────────────────────────────────────────────────

  private buildRockyInterior(config: TunnelConfig): void {
    const { startDistance, length, archInnerWidth, archInnerHeight, archRingSpacing } = config;
    const endDistance = startDistance + length;

    const stoneMat = this.createMaterial(
      new MeshStandardMaterial({ color: "#5e5850", roughness: 0.97, metalness: 0.01 }),
    );

    // ── Ceiling rock panels ──────────────────────────────────────────────
    // Flat boxes that tile the ceiling between arch rings, giving the impression
    // of rough rock lining. Placed at archInnerHeight so they sit flush with the
    // inner top surface of the bore.
    const panelSpacing = archRingSpacing;
    const panelDepth = panelSpacing * 0.90;
    const panelThick = 0.28;
    const ceilGeo = this.createGeometry(new BoxGeometry(archInnerWidth, panelThick, panelDepth));

    const ceilPositions: number[] = [];
    for (let d = startDistance + panelSpacing * 0.5; d < endDistance; d += panelSpacing) {
      ceilPositions.push(d);
    }

    if (ceilPositions.length > 0) {
      const ceilMesh = new InstancedMesh(ceilGeo, stoneMat, ceilPositions.length);
      ceilMesh.receiveShadow = true;
      ceilPositions.forEach((d, i) => {
        placeAlongTrack(_dummy, this.spline, d, 0, archInnerHeight + panelThick * 0.5, false);
        _dummy.updateMatrixWorld(true);
        _dummy.getWorldPosition(_pos);
        _dummy.getWorldQuaternion(_quat);
        _mat.compose(_pos, _quat, _scale);
        ceilMesh.setMatrixAt(i, _mat);
      });
      ceilMesh.instanceMatrix.needsUpdate = true;
      this.root.add(ceilMesh);
    }

    // ── Stalactites ──────────────────────────────────────────────────────
    // Small stone cones hanging from the ceiling, each scaled and flipped so the
    // apex points downward.  Uses a unit-height ConeGeometry (height = 1) and
    // scales Y per instance so a single geometry serves all lengths.
    const stalSpacing = 2.2;
    type StalEntry = { d: number; lat: number; len: number };
    const stalEntries: StalEntry[] = [];

    for (let d = startDistance + stalSpacing; d < endDistance - stalSpacing; d += stalSpacing) {
      const n = 1 + Math.floor(this.hash(d) * 3); // 1–3 per cluster
      for (let j = 0; j < n; j++) {
        const lat = (this.hash(d * 7.3 + j * 31.1) - 0.5) * (archInnerWidth * 0.72);
        const len = 0.25 + this.hash(d * 3.7 + j * 17.3) * 0.45; // 0.25 – 0.70 m
        stalEntries.push({ d, lat, len });
      }
    }

    if (stalEntries.length > 0) {
      // height = 1 in geometry space; scaled per instance via _scaleB.y = len
      const stalBaseGeo = this.createGeometry(new ConeGeometry(0.11, 1.0, 5, 1));
      const stalMesh = new InstancedMesh(stalBaseGeo, stoneMat, stalEntries.length);
      stalMesh.receiveShadow = true;

      stalEntries.forEach(({ d, lat, len }, i) => {
        // After flipping, ConeGeometry base (+Y/2 → now world top) is at archInnerHeight
        // and apex (-Y/2 → now world bottom) hangs len metres below.
        // So center must be at archInnerHeight - len * 0.5.
        const centerY = archInnerHeight - len * 0.5;
        placeAlongTrack(_dummy, this.spline, d, lat, centerY, false);
        _dummy.updateMatrixWorld(true);
        _dummy.getWorldPosition(_pos);
        _dummy.getWorldQuaternion(_quat);

        // Rotate 180° around track-right (local X) so apex points down
        _quatB.copy(_quat).multiply(_FLIP_X180);
        _scaleB.set(1, len, 1);
        _mat.compose(_pos, _quatB, _scaleB);
        stalMesh.setMatrixAt(i, _mat);
      });

      stalMesh.instanceMatrix.needsUpdate = true;
      this.root.add(stalMesh);
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /** Deterministic pseudo-random value in [0, 1) — integer or float input. */
  private hash(x: number): number {
    const v = Math.sin(x * 127.1) * 43758.5453;
    return v - Math.floor(v);
  }

  private createGeometry<T extends BufferGeometry>(geometry: T): T {
    this.disposableGeometries.push(geometry);
    return geometry;
  }

  private createMaterial<T extends Material>(material: T): T {
    this.disposableMaterials.push(material);
    return material;
  }
}
