import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  BoxGeometry,
  Vector3,
  Color,
  Texture,
} from "three";
import { TrackSpline } from "./TrackSpline";
import {
  ballastFragment,
  ballastMapFragment,
  ballastVertex,
  ballastWorldPosVertex,
  railFragment,
  railMapFragment,
  railVertex,
  railWorldPosVertex,
  sleeperFragment,
  sleeperMapFragment,
  sleeperVertex,
  sleeperWorldPosVertex,
} from "./shaders/trackShader";
import { CriticalPreloadedAssets } from "../../loading/CriticalAssetPreloader";

export type TrackMeshConfig = {
  sampleCountForMesh: number;
  railGauge: number;
  railSegmentLength: number;
  sleeperSpacing: number;
  ballastWidth: number;
  ballastHeight: number;
  ballastTopOffset: number;
  ballastSideTaper: number;
  railWidth: number;
  railHeight: number;
  railBaseOffset: number;
  sleeperWidth: number;
  sleeperHeight: number;
  sleeperDepth: number;
  sleeperBaseOffset: number;
};

const UP = new Vector3(0, 1, 0);

export class TrackMeshBuilder {
  private readonly center = new Vector3();
  private readonly tangent = new Vector3();
  private readonly right = new Vector3();
  private readonly tmp = new Vector3();
  private readonly dirtPathTexture: Texture;
  private readonly woodenPlankTexture: Texture;
  private readonly railTexture: Texture;

  constructor(
    private readonly spline: TrackSpline,
    private readonly config: TrackMeshConfig,
    preloadedAssets: CriticalPreloadedAssets,
  ) {
    this.dirtPathTexture = preloadedAssets.dirtPathTexture;
    this.woodenPlankTexture = preloadedAssets.woodenPlankTexture;
    this.railTexture = preloadedAssets.railTexture;
  }

  build(): Group {
    const group = new Group();

    group.name = "track-mesh";
    group.add(this.buildBallastMesh());
    group.add(this.buildSleeperMesh());
    group.add(this.buildRailMesh(-1));
    group.add(this.buildRailMesh(1));

    return group;
  }

  private buildBallastMesh(): Mesh {
    const sampleCount = Math.max(12, this.config.sampleCountForMesh);
    const ringCount = sampleCount + 1;
    const vertices = new Float32Array(ringCount * 4 * 3);
    const uvs = new Float32Array(ringCount * 4 * 2);
    const indices: number[] = [];
    const halfWidth = this.config.ballastWidth * 0.5;
    const thickness = this.config.ballastHeight;
    const sideTaper = Math.max(0, this.config.ballastSideTaper);

    const sideWidth = Math.hypot(sideTaper, thickness);
    const totalWidth = sideWidth * 2 + this.config.ballastWidth;
    const uTopLeft = sideWidth / totalWidth;
    const uTopRight = (sideWidth + this.config.ballastWidth) / totalWidth;

    for (let i = 0; i < ringCount; i += 1) {
      const distance = (i / sampleCount) * this.spline.getLength();
      this.sampleFrame(distance);

      const topCenter = this.center.clone();
      topCenter.y += this.config.ballastTopOffset;
      const topLeft = topCenter.clone().addScaledVector(this.right, -halfWidth);
      const topRight = topCenter.clone().addScaledVector(this.right, halfWidth);
      const bottomLeft = topLeft
        .clone()
        .addScaledVector(this.right, -sideTaper)
        .addScaledVector(UP, -thickness);
      const bottomRight = topRight
        .clone()
        .addScaledVector(this.right, sideTaper)
        .addScaledVector(UP, -thickness);

      const vertexOffset = i * 12;
      this.writeVertex(vertices, vertexOffset, topLeft);
      this.writeVertex(vertices, vertexOffset + 3, topRight);
      this.writeVertex(vertices, vertexOffset + 6, bottomLeft);
      this.writeVertex(vertices, vertexOffset + 9, bottomRight);

      const uvOffset = i * 8;
      const uvV = distance / totalWidth;
      uvs[uvOffset] = uTopLeft;
      uvs[uvOffset + 1] = uvV;
      uvs[uvOffset + 2] = uTopRight;
      uvs[uvOffset + 3] = uvV;
      uvs[uvOffset + 4] = 0;
      uvs[uvOffset + 5] = uvV;
      uvs[uvOffset + 6] = 1;
      uvs[uvOffset + 7] = uvV;

      if (i < sampleCount) {
        const a = i * 4;
        const b = (i + 1) * 4;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a, b, a + 2, b, b + 2, a + 2);
        indices.push(a + 1, a + 3, b + 1, b + 1, a + 3, b + 3);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.0,
      map: this.dirtPathTexture,
      color: new Color("#ffffff"),
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = ballastVertex(shader.vertexShader).replace(
        "#include <worldpos_vertex>",
        ballastWorldPosVertex(),
      );

      shader.fragmentShader = ballastFragment(shader.fragmentShader).replace(
        "#include <map_fragment>",
        ballastMapFragment(),
      );
    };

    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildRailMesh(side: -1 | 1): InstancedMesh {
    const length = this.spline.getLength();
    const segmentLength = Math.max(0.5, this.config.railSegmentLength);
    const count = Math.max(1, Math.floor(length / segmentLength));
    const geometry = new BoxGeometry(
      this.config.railWidth,
      this.config.railHeight,
      segmentLength,
    );
    const material = new MeshStandardMaterial({
      color: 0xbcc6ce,
      roughness: 0.28,
      metalness: 0.95,
      map: this.railTexture,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = railVertex(shader.vertexShader).replace(
        "#include <worldpos_vertex>",
        railWorldPosVertex(),
      );

      shader.fragmentShader = railFragment(shader.fragmentShader).replace(
        "#include <map_fragment>",
        railMapFragment(),
      );
    };

    const rails = new InstancedMesh(geometry, material, count);
    rails.castShadow = true;
    rails.receiveShadow = true;

    const offset = this.config.railGauge * 0.5 * side;
    const yOffset =
      this.config.ballastTopOffset +
      this.config.railBaseOffset +
      this.config.railHeight * 0.5;
    const instance = new Object3D();

    for (let i = 0; i < count; i += 1) {
      const distance = Math.min(
        length,
        i * segmentLength + segmentLength * 0.5,
      );
      this.sampleFrame(distance);

      instance.position.copy(this.center).addScaledVector(this.right, offset);
      instance.position.y += yOffset;

      this.tmp.copy(instance.position).add(this.tangent);
      instance.up.copy(UP);
      instance.lookAt(this.tmp);
      instance.updateMatrix();

      rails.setMatrixAt(i, instance.matrix);
    }

    rails.instanceMatrix.needsUpdate = true;
    return rails;
  }

  private buildSleeperMesh(): InstancedMesh {
    const length = this.spline.getLength();
    const sleeperSpacing = Math.max(0.6, this.config.sleeperSpacing);
    const count = Math.max(1, Math.floor(length / sleeperSpacing));
    const geometry = new BoxGeometry(
      this.config.sleeperWidth,
      this.config.sleeperHeight,
      this.config.sleeperDepth,
    );
    const material = new MeshStandardMaterial({
      color: 0x6d4f35,
      roughness: 0.9,
      metalness: 0.08,
      map: this.woodenPlankTexture,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = sleeperVertex(shader.vertexShader).replace(
        "#include <worldpos_vertex>",
        sleeperWorldPosVertex(),
      );

      shader.fragmentShader = sleeperFragment(shader.fragmentShader).replace(
        "#include <map_fragment>",
        sleeperMapFragment(),
      );
    };
    const sleepers = new InstancedMesh(geometry, material, count);
    sleepers.castShadow = true;
    sleepers.receiveShadow = true;

    const yOffset =
      this.config.ballastTopOffset +
      this.config.sleeperBaseOffset +
      this.config.sleeperHeight * 0.5;
    const instance = new Object3D();

    for (let i = 0; i < count; i += 1) {
      const distance = i * sleeperSpacing;
      this.sampleFrame(distance);

      instance.position.copy(this.center);
      instance.position.y += yOffset;

      this.tmp.copy(this.center).add(this.tangent);
      instance.up.copy(UP);
      instance.lookAt(this.tmp);
      instance.updateMatrix();

      sleepers.setMatrixAt(i, instance.matrix);
    }

    sleepers.instanceMatrix.needsUpdate = true;
    return sleepers;
  }

  private sampleFrame(distance: number): void {
    this.center.copy(this.spline.getPositionAtDistance(distance));
    this.tangent.copy(this.spline.getTangentAtDistance(distance));
    this.right.crossVectors(this.tangent, UP).normalize();
  }

  private writeVertex(
    buffer: Float32Array,
    offset: number,
    value: Vector3,
  ): void {
    buffer[offset] = value.x;
    buffer[offset + 1] = value.y;
    buffer[offset + 2] = value.z;
  }
}
