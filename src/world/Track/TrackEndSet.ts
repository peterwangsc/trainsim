import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CylinderGeometry,
  FrontSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { TrackSpline } from "./TrackSpline";
import { CriticalPreloadedAssets } from "../../loading/CriticalAssetPreloader";

export type TrackEndSetConfig = {
  bumperOffsetFromTrackEnd: number;
  stationLength: number;
  stationGapToBumper: number;
  signDistancesFromBumper: readonly number[];
  signLateralOffset: number;
  platformWidth: number;
  platformHeight: number;
  platformLateralOffset: number;
  platformSegmentLength: number;
  railGauge: number;
};

export type TrackEndLayout = {
  bumperDistance: number;
  stationStartDistance: number;
  stationEndDistance: number;
};

const UP = new Vector3(0, 1, 0);

type SignDescriptor = {
  heading: string;
  detail: string;
  background: string;
};

export class TrackEndSet {
  readonly root = new Group();

  private readonly center = new Vector3();
  private readonly tangent = new Vector3();
  private readonly right = new Vector3();
  private readonly lookTarget = new Vector3();

  private readonly disposableGeometries: BufferGeometry[] = [];
  private readonly disposableMaterials: Material[] = [];
  private readonly disposableTextures: Texture[] = [];

  private readonly layout: TrackEndLayout;

  private readonly dirtPathTexture: Texture;
  private readonly darkBrushedMetalTexture: Texture;
  private readonly knurledMetalTexture: Texture;
  private readonly concretePlatformTexture: Texture;
  private readonly corrugatedMetalRoofTexture: Texture;
  private readonly redPaintedMetalTexture: Texture;
  private readonly brickStationWallTexture: Texture;

  constructor(
    private readonly spline: TrackSpline,
    private readonly config: TrackEndSetConfig,
    preloadedAssets: CriticalPreloadedAssets,
  ) {
    this.dirtPathTexture = preloadedAssets.dirtPathTexture;
    this.darkBrushedMetalTexture = preloadedAssets.darkBrushedMetalTexture;
    this.knurledMetalTexture = preloadedAssets.knurledMetalTexture;
    this.concretePlatformTexture = preloadedAssets.concretePlatformTexture;
    this.corrugatedMetalRoofTexture =
      preloadedAssets.corrugatedMetalRoofTexture;
    this.redPaintedMetalTexture = preloadedAssets.redPaintedMetalTexture;
    this.brickStationWallTexture = preloadedAssets.brickStationWallTexture;
    const trackLength = this.spline.getLength();
    const bumperOffset = Math.max(1, this.config.bumperOffsetFromTrackEnd);
    const bumperDistance = Math.max(4, trackLength - bumperOffset);
    const stationGap = Math.max(5, this.config.stationGapToBumper);
    const stationEndDistance = Math.max(0, bumperDistance - stationGap);
    const stationLength = Math.max(20, this.config.stationLength);
    const stationStartDistance = Math.max(
      0,
      stationEndDistance - stationLength,
    );

    this.layout = {
      bumperDistance,
      stationStartDistance,
      stationEndDistance,
    };

    this.root.name = "track-end-set";
    this.build();
  }

  getLayout(): TrackEndLayout {
    return this.layout;
  }

  dispose(): void {
    this.root.removeFromParent();

    for (const texture of this.disposableTextures) {
      texture.dispose();
    }

    for (const material of this.disposableMaterials) {
      material.dispose();
    }

    for (const geometry of this.disposableGeometries) {
      geometry.dispose();
    }
  }

  private build(): void {
    this.addApproachSigns();
    this.addStationPlatform();
    this.addStationBuilding();
    this.addBumper();
  }

  private addApproachSigns(): void {
    const signDistances = [...this.config.signDistancesFromBumper].sort(
      (a, b) => b - a,
    );

    for (const [index, distanceFromBumper] of signDistances.entries()) {
      const distance = this.layout.bumperDistance - distanceFromBumper;
      if (distance <= 3 || distance >= this.layout.bumperDistance - 2) {
        continue;
      }

      const descriptor = this.resolveSignDescriptor(
        distanceFromBumper,
        signDistances.length,
        index,
      );
      const sign = this.createSign(descriptor.heading, descriptor.detail, {
        background: descriptor.background,
      });

      this.placeAlongTrack(
        sign,
        distance,
        this.config.signLateralOffset,
        0,
        true,
      );
      this.root.add(sign);
    }
  }

  private addStationPlatform(): void {
    const segmentLength = Math.max(6, this.config.platformSegmentLength);
    const stationDistance =
      this.layout.stationEndDistance - this.layout.stationStartDistance;
    const segmentCount = Math.max(
      1,
      Math.ceil(stationDistance / segmentLength),
    );

    const pw = this.config.platformWidth;
    const ph = this.config.platformHeight;
    const pd = segmentLength * 1.02;
    const platformGeometry = this.createGeometry(new BoxGeometry(pw, ph, pd));
    const platformMaterials = this.createMaterial(
      new MeshStandardMaterial({
        color: "#d0d0c8",
        map: this.concretePlatformTexture,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );

    const canopyPostGeometry = this.createGeometry(
      new BoxGeometry(0.2, 2.7, 0.2),
    );
    const canopyPostMaterials = this.createMaterial(
      new MeshStandardMaterial({
        color: "#8a94a0",
        map: this.darkBrushedMetalTexture,
        roughness: 0.6,
        metalness: 0.8,
      }),
    );

    const crw = this.config.platformWidth * 0.76;
    const crd = segmentLength * 1.02;
    const canopyRoofGeometry = this.createGeometry(
      new BoxGeometry(crw, 0.16, crd),
    );
    const canopyRoofMaterials = this.createMaterial(
      new MeshStandardMaterial({
        color: "#5f6c7a",
        map: this.corrugatedMetalRoofTexture,
        roughness: 0.95,
        metalness: 0.0,
      }),
    );

    for (let index = 0; index < segmentCount; index += 1) {
      const distance =
        this.layout.stationStartDistance + (index + 0.5) * segmentLength;
      if (distance >= this.layout.stationEndDistance) {
        continue;
      }

      const platform = new Mesh(platformGeometry, platformMaterials);
      platform.castShadow = true;
      platform.receiveShadow = true;
      this.placeAlongTrack(
        platform,
        distance,
        this.config.platformLateralOffset,
        this.config.platformHeight * 0.5,
        true,
      );
      this.root.add(platform);

      if (index % 2 === 0) {
        const canopyPost = new Mesh(canopyPostGeometry, canopyPostMaterials);
        canopyPost.castShadow = true;
        canopyPost.receiveShadow = true;
        this.placeAlongTrack(
          canopyPost,
          distance,
          this.config.platformLateralOffset + this.config.platformWidth * 0.25,
          1.35,
        );
        this.root.add(canopyPost);

        const canopyRoof = new Mesh(canopyRoofGeometry, canopyRoofMaterials);
        canopyRoof.castShadow = true;
        canopyRoof.receiveShadow = true;
        this.placeAlongTrack(
          canopyRoof,
          distance,
          this.config.platformLateralOffset,
          2.75,
        );
        this.root.add(canopyRoof);

        const platformLight = new PointLight(0xffe8b0, 12, 18, 1.25);
        this.placeAlongTrack(
          platformLight,
          distance,
          this.config.platformLateralOffset,
          2.65,
        );
        this.root.add(platformLight);
      }
    }
  }

  private addStationBuilding(): void {
    const stationDistance =
      this.layout.stationStartDistance +
      Math.min(
        18,
        (this.layout.stationEndDistance - this.layout.stationStartDistance) *
          0.2,
      );

    const buildingMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#e8e8e0",
        roughness: 0.85,
        metalness: 0.0,
        map: this.brickStationWallTexture,
      }),
    );

    const buildingGroup = new Group();
    const frontBackGeometry = this.createGeometry(new PlaneGeometry(6.6, 3.4));
    const leftRightGeometry = this.createGeometry(new PlaneGeometry(8.8, 3.4));

    const scaleUvs = (
      geometry: BufferGeometry,
      scaleX: number,
      scaleY: number,
    ) => {
      const uvs = geometry.attributes.uv;
      if (uvs) {
        for (let i = 0; i < uvs.count; i++) {
          uvs.setXY(i, uvs.getX(i) * scaleX, uvs.getY(i) * scaleY);
        }
        uvs.needsUpdate = true;
      }
    };
    scaleUvs(frontBackGeometry, 6.6 * 0.6, 3.4 * 0.6);
    scaleUvs(leftRightGeometry, 8.8 * 0.6, 3.4 * 0.6);

    const frontWall = new Mesh(frontBackGeometry, buildingMaterial);
    frontWall.position.set(0, 0, 4.4);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    buildingGroup.add(frontWall);

    const backWall = new Mesh(frontBackGeometry, buildingMaterial);
    backWall.position.set(0, 0, -4.4);
    backWall.rotation.y = Math.PI;
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    buildingGroup.add(backWall);

    const leftWall = new Mesh(leftRightGeometry, buildingMaterial);
    leftWall.position.set(-3.3, 0, 0);
    leftWall.rotation.y = -Math.PI / 2;
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    buildingGroup.add(leftWall);

    const rightWall = new Mesh(leftRightGeometry, buildingMaterial);
    rightWall.position.set(3.3, 0, 0);
    rightWall.rotation.y = Math.PI / 2;
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    buildingGroup.add(rightWall);

    this.placeAlongTrack(
      buildingGroup,
      stationDistance - 3,
      this.config.platformLateralOffset + this.config.platformWidth * 0.75,
      1.7,
    );
    this.root.add(buildingGroup);

    const roof = new Mesh(
      this.createGeometry(new BoxGeometry(7.4, 0.36, 9.6)),
      this.createMaterial(
        new MeshStandardMaterial({
          color: "#4a5460",
          map: this.corrugatedMetalRoofTexture,
          roughness: 0.7,
          metalness: 0.6,
        }),
      ),
    );
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.placeAlongTrack(
      roof,
      stationDistance - 3,
      this.config.platformLateralOffset + this.config.platformWidth * 0.75,
      3.55,
    );
    this.root.add(roof);

    const stationSign = this.createSign(
      "RIDGE TERMINAL",
      "STOP BEFORE PLATFORM END",
      {
        background: "#f8f0c6",
        panelWidth: 2.9,
        panelHeight: 0.9,
        postHeight: 2.8,
      },
    );
    this.placeAlongTrack(
      stationSign,
      this.layout.stationStartDistance + 12,
      -(this.config.platformLateralOffset + this.config.platformWidth * 0.12),
      0,
      true,
    );
    this.root.add(stationSign);
  }

  private addBumper(): void {
    const bumperGroup = new Group();

    const bumperWidth = this.config.railGauge + 0.82;
    const bw = bumperWidth;
    const postGeometry = this.createGeometry(new BoxGeometry(0.24, 1.1, 0.28));
    const beamGeometry = this.createGeometry(
      new BoxGeometry(bw + 0.3, 0.34, 0.32),
    );
    const plateGeometry = this.createGeometry(
      new BoxGeometry(bw + 0.18, 0.58, 0.08),
    );

    const postMaterials = this.createMaterial(
      new MeshStandardMaterial({
        color: "#c02020",
        map: this.redPaintedMetalTexture,
        roughness: 0.6,
        metalness: 0.8,
      }),
    );

    const beamMaterials = this.createMaterial(
      new MeshStandardMaterial({
        color: "#d41a1a",
        map: this.redPaintedMetalTexture,
        roughness: 0.5,
        metalness: 0.8,
      }),
    );

    const plateMaterials = this.createMaterial(
      new MeshStandardMaterial({
        color: "#ffd44a",
        map: this.knurledMetalTexture,
        roughness: 0.5,
        metalness: 0.8,
      }),
    );

    for (const side of [-1, 1] as const) {
      const post = new Mesh(postGeometry, postMaterials);
      post.position.set(bumperWidth * 0.5 * side, 0.55, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      bumperGroup.add(post);
    }

    const beam = new Mesh(beamGeometry, beamMaterials);
    beam.position.set(0, 0.78, 0);
    beam.castShadow = true;
    beam.receiveShadow = true;
    bumperGroup.add(beam);

    const plate = new Mesh(plateGeometry, plateMaterials);
    plate.position.set(0, 0.9, -0.16);
    plate.castShadow = true;
    plate.receiveShadow = true;
    bumperGroup.add(plate);

    this.placeAlongTrack(bumperGroup, this.layout.bumperDistance, 0, 0);
    this.root.add(bumperGroup);
  }

  private resolveSignDescriptor(
    distanceFromBumper: number,
    signCount: number,
    signIndex: number,
  ): SignDescriptor {
    if (distanceFromBumper <= 70) {
      return {
        heading: "STOP NOW",
        detail: "BUMPER AHEAD",
        background: "#ffe0d5",
      };
    }

    if (signIndex >= signCount - 2 || distanceFromBumper <= 150) {
      return {
        heading: "STATION AHEAD",
        detail: `${Math.round(distanceFromBumper)} m TO END`,
        background: "#fff1bf",
      };
    }

    return {
      heading: "END OF LINE",
      detail: `${Math.round(distanceFromBumper)} m`,
      background: "#f8f8f8",
    };
  }

  private createSign(
    heading: string,
    detail: string,
    options: {
      background: string;
      panelWidth?: number;
      panelHeight?: number;
      postHeight?: number;
    },
  ): Group {
    const sign = new Group();
    const panelWidth = options.panelWidth ?? 1.9;
    const panelHeight = options.panelHeight ?? 1.2;
    const postHeight = options.postHeight ?? 2.7;

    const post = new Mesh(
      this.createGeometry(new CylinderGeometry(0.06, 0.08, postHeight, 10)),
      this.createMaterial(
        new MeshStandardMaterial({
          color: "#555d66",
          roughness: 0.6,
          metalness: 0.8,
          map: this.darkBrushedMetalTexture,
        }),
      ),
    );
    post.position.y = postHeight * 0.5 - 2.5;
    post.castShadow = true;
    post.receiveShadow = true;
    sign.add(post);

    const panelTexture = this.createSignTexture(
      heading,
      detail,
      options.background,
    );

    const panel = new Mesh(
      this.createGeometry(new PlaneGeometry(panelWidth, panelHeight)),
      this.createMaterial(
        new MeshStandardMaterial({
          map: panelTexture,
          emissiveMap: panelTexture,
          emissive: new Color(0.55, 0.55, 0.55),
          roughness: 0.6,
          metalness: 0.0,
          side: FrontSide,
        }),
      ),
    );
    panel.position.y = postHeight + panelHeight * 0.5 - 2.5;
    panel.castShadow = true;
    panel.receiveShadow = false;
    sign.add(panel);

    return sign;
  }

  private createSignTexture(
    heading: string,
    detail: string,
    background: string,
  ): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 512;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create sign canvas context");
    }

    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#181818";
    context.lineWidth = 30;
    context.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    context.fillStyle = "#181818";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.font = "700 98px 'Trebuchet MS', 'Segoe UI', sans-serif";
    context.fillText(
      heading,
      canvas.width / 2,
      canvas.height * 0.38,
      canvas.width * 0.84,
    );

    context.font = "700 64px 'Trebuchet MS', 'Segoe UI', sans-serif";
    context.fillText(
      detail,
      canvas.width / 2,
      canvas.height * 0.67,
      canvas.width * 0.84,
    );

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    this.disposableTextures.push(texture);
    return texture;
  }

  private placeAlongTrack(
    object: Object3D,
    distance: number,
    lateralOffset: number,
    heightOffset: number,
    faceBackward = false,
  ): void {
    this.sampleFrame(distance);

    object.position
      .copy(this.center)
      .addScaledVector(this.right, lateralOffset);
    object.position.y += heightOffset;

    this.lookTarget.copy(this.tangent);
    if (faceBackward) {
      this.lookTarget.multiplyScalar(-1);
    }
    this.lookTarget.add(object.position);
    object.up.copy(UP);
    object.lookAt(this.lookTarget);
  }

  private sampleFrame(distance: number): void {
    this.center.copy(this.spline.getPositionAtDistance(distance));
    this.tangent.copy(this.spline.getTangentAtDistance(distance));
    this.right.crossVectors(this.tangent, UP).normalize();
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
