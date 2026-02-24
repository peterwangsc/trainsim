import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  CylinderGeometry,
  FrontSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { TrackSpline } from "./TrackSpline";

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
  private readonly disposableTextures: CanvasTexture[] = [];

  private readonly layout: TrackEndLayout;

  constructor(
    private readonly spline: TrackSpline,
    private readonly config: TrackEndSetConfig,
  ) {
    const trackLength = this.spline.getLength();
    const bumperOffset = Math.max(1, this.config.bumperOffsetFromTrackEnd);
    const bumperDistance = Math.max(4, trackLength - bumperOffset);
    const stationGap = Math.max(5, this.config.stationGapToBumper);
    const stationEndDistance = Math.max(0, bumperDistance - stationGap);
    const stationLength = Math.max(20, this.config.stationLength);
    const stationStartDistance = Math.max(0, stationEndDistance - stationLength);

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
    const stationDistance = this.layout.stationEndDistance - this.layout.stationStartDistance;
    const segmentCount = Math.max(1, Math.ceil(stationDistance / segmentLength));

    const platformGeometry = this.createGeometry(
      new BoxGeometry(
        this.config.platformWidth,
        this.config.platformHeight,
        segmentLength * 1.02,
      ),
    );
    const platformMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#b5b5b0",
        roughness: 0.86,
        metalness: 0.05,
      }),
    );

    const canopyPostGeometry = this.createGeometry(
      new BoxGeometry(0.2, 2.7, 0.2),
    );
    const canopyPostMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#535c66",
        roughness: 0.6,
        metalness: 0.25,
      }),
    );

    const canopyRoofGeometry = this.createGeometry(
      new BoxGeometry(this.config.platformWidth * 0.76, 0.16, segmentLength * 1.02),
    );
    const canopyRoofMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#2f3d4b",
        roughness: 0.5,
        metalness: 0.3,
      }),
    );

    for (let index = 0; index < segmentCount; index += 1) {
      const distance = this.layout.stationStartDistance + (index + 0.5) * segmentLength;
      if (distance >= this.layout.stationEndDistance) {
        continue;
      }

      const platform = new Mesh(platformGeometry, platformMaterial);
      platform.castShadow = false;
      platform.receiveShadow = true;
      this.placeAlongTrack(
        platform,
        distance,
        this.config.platformLateralOffset,
        this.config.platformHeight * 0.5,
      );
      this.root.add(platform);

      if (index % 2 === 0) {
        const canopyPost = new Mesh(canopyPostGeometry, canopyPostMaterial);
        canopyPost.castShadow = false;
        canopyPost.receiveShadow = true;
        this.placeAlongTrack(
          canopyPost,
          distance,
          this.config.platformLateralOffset + this.config.platformWidth * 0.25,
          1.35,
        );
        this.root.add(canopyPost);

        const canopyRoof = new Mesh(canopyRoofGeometry, canopyRoofMaterial);
        canopyRoof.castShadow = false;
        canopyRoof.receiveShadow = true;
        this.placeAlongTrack(
          canopyRoof,
          distance,
          this.config.platformLateralOffset,
          2.75,
        );
        this.root.add(canopyRoof);
      }
    }
  }

  private addStationBuilding(): void {
    const stationDistance =
      this.layout.stationStartDistance +
      Math.min(18, (this.layout.stationEndDistance - this.layout.stationStartDistance) * 0.2);

    const building = new Mesh(
      this.createGeometry(new BoxGeometry(6.6, 3.4, 8.8)),
      this.createMaterial(
        new MeshStandardMaterial({
          color: "#d4d4cb",
          roughness: 0.84,
          metalness: 0.02,
        }),
      ),
    );
    building.castShadow = false;
    building.receiveShadow = true;
    this.placeAlongTrack(
      building,
      stationDistance,
      this.config.platformLateralOffset + this.config.platformWidth * 0.62,
      1.7,
    );
    this.root.add(building);

    const roof = new Mesh(
      this.createGeometry(new BoxGeometry(7.4, 0.36, 9.6)),
      this.createMaterial(
        new MeshStandardMaterial({
          color: "#3a424b",
          roughness: 0.6,
          metalness: 0.25,
        }),
      ),
    );
    roof.castShadow = false;
    roof.receiveShadow = true;
    this.placeAlongTrack(
      roof,
      stationDistance,
      this.config.platformLateralOffset + this.config.platformWidth * 0.62,
      3.55,
    );
    this.root.add(roof);

    const stationSign = this.createSign("RIDGE TERMINAL", "STOP BEFORE PLATFORM END", {
      background: "#f8f0c6",
      panelWidth: 2.9,
      panelHeight: 0.9,
      postHeight: 2.8,
    });
    this.placeAlongTrack(
      stationSign,
      this.layout.stationStartDistance + 12,
      this.config.platformLateralOffset + this.config.platformWidth * 0.12,
      0,
      true,
    );
    this.root.add(stationSign);
  }

  private addBumper(): void {
    const bumperGroup = new Group();

    const bumperWidth = this.config.railGauge + 0.82;
    const postGeometry = this.createGeometry(new BoxGeometry(0.24, 1.1, 0.28));
    const beamGeometry = this.createGeometry(
      new BoxGeometry(bumperWidth + 0.3, 0.34, 0.32),
    );
    const plateGeometry = this.createGeometry(new BoxGeometry(bumperWidth + 0.18, 0.58, 0.08));

    const postMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#8f1616",
        roughness: 0.55,
        metalness: 0.35,
      }),
    );
    const beamMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#b21717",
        roughness: 0.45,
        metalness: 0.45,
      }),
    );
    const plateMaterial = this.createMaterial(
      new MeshStandardMaterial({
        color: "#f2c84a",
        roughness: 0.62,
        metalness: 0.08,
      }),
    );

    for (const side of [-1, 1] as const) {
      const post = new Mesh(postGeometry, postMaterial);
      post.position.set((bumperWidth * 0.5) * side, 0.55, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      bumperGroup.add(post);
    }

    const beam = new Mesh(beamGeometry, beamMaterial);
    beam.position.set(0, 0.78, 0);
    beam.castShadow = true;
    beam.receiveShadow = true;
    bumperGroup.add(beam);

    const plate = new Mesh(plateGeometry, plateMaterial);
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
          color: "#444b53",
          roughness: 0.6,
          metalness: 0.4,
        }),
      ),
    );
    post.position.y = postHeight * 0.5;
    post.castShadow = true;
    post.receiveShadow = true;
    sign.add(post);

    const panelTexture = this.createSignTexture(heading, detail, options.background);
    const panel = new Mesh(
      this.createGeometry(new PlaneGeometry(panelWidth, panelHeight)),
      this.createMaterial(
        new MeshStandardMaterial({
          map: panelTexture,
          roughness: 0.74,
          metalness: 0.03,
          side: FrontSide,
        }),
      ),
    );
    panel.position.y = postHeight + panelHeight * 0.5;
    panel.castShadow = true;
    panel.receiveShadow = true;
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
    context.fillText(heading, canvas.width / 2, canvas.height * 0.38, canvas.width * 0.84);

    context.font = "700 64px 'Trebuchet MS', 'Segoe UI', sans-serif";
    context.fillText(detail, canvas.width / 2, canvas.height * 0.67, canvas.width * 0.84);

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

    object.position.copy(this.center).addScaledVector(this.right, lateralOffset);
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
