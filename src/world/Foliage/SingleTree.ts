import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector2,
} from "three";
import {
  canopyDefaultNormalVertex,
  canopyFragmentCommon,
  canopyLightsFragmentBegin,
  canopyMapFragment,
  canopyShadowMapVertex,
  canopyVertexCommon,
  trunkFragmentCommon,
  trunkLightsFragmentBegin,
} from "@/world/Foliage/shaders/singleTreeShader";

type SingleTreeProps = {
  position: readonly [number, number, number];
  heightScale?: number;
  species?: SingleTreeSpecies;
  variationSeed?: number;
};

export type SingleTreeSpecies = "pine" | "redwood" | "fir";

export type SingleTreeTrunkCollider = {
  halfHeight: number;
  centerY: number;
  radius: number;
};

type CanopyLayerTemplate = {
  y: number;
  radius: number;
  height: number;
  color: string;
};

type SpeciesShapeProfile = {
  canopyLayers: readonly CanopyLayerTemplate[];
  canopyTwistRadians: number;
  asymmetry: number;
  trunkTopRadius: number;
  trunkBottomRadius: number;
  trunkTaperExponent: number;
  trunkTopMargin: number;
  trunkCanopyPenetration: number;
};

type SingleTreeShape = {
  normalizedHeightScale: number;
  canopyLayers: Array<{
    y: number;
    x: number;
    z: number;
    radius: number;
    height: number;
    twist: number;
    color: string;
  }>;
  canopyBounds: {
    lowestBottom: number;
    highestTop: number;
  };
  trunkDimensions: {
    height: number;
    y: number;
  };
  trunkRadii: {
    top: number;
    bottom: number;
  };
};

const SPECIES_SHAPE_PROFILES: Record<SingleTreeSpecies, SpeciesShapeProfile> = {
  pine: {
    canopyLayers: [
      { y: 6.7, radius: 3.6, height: 4.8, color: "#3C7738" },
      { y: 8.7, radius: 3.0, height: 4.0, color: "#376F35" },
      { y: 10.6, radius: 2.3, height: 3.2, color: "#336832" },
      { y: 12.1, radius: 1.65, height: 2.5, color: "#305F2E" },
      { y: 13.3, radius: 1.05, height: 1.9, color: "#2B562A" },
    ],
    canopyTwistRadians: Math.PI * 0.36,
    asymmetry: 0.11,
    trunkTopRadius: 0.03,
    trunkBottomRadius: 0.56,
    trunkTaperExponent: 2.45,
    trunkTopMargin: 0.45,
    trunkCanopyPenetration: 0.35,
  },
  redwood: {
    canopyLayers: [
      { y: 12.9, radius: 2.0, height: 2.9, color: "#3E7738" },
      { y: 14.5, radius: 2.15, height: 2.7, color: "#3C7536" },
      { y: 16.2, radius: 1.9, height: 2.5, color: "#396F35" },
      { y: 17.8, radius: 1.55, height: 2.3, color: "#346A32" },
      { y: 19.1, radius: 1.2, height: 2.0, color: "#30612E" },
      { y: 20.2, radius: 0.86, height: 1.6, color: "#2C582A" },
    ],
    canopyTwistRadians: Math.PI * 0.22,
    asymmetry: 0.07,
    trunkTopRadius: 0.04,
    trunkBottomRadius: 0.72,
    trunkTaperExponent: 2.2,
    trunkTopMargin: 0.38,
    trunkCanopyPenetration: 0.24,
  },
  fir: {
    canopyLayers: [
      { y: 6.4, radius: 3.0, height: 3.8, color: "#376F35" },
      { y: 8.1, radius: 2.45, height: 3.4, color: "#346B33" },
      { y: 9.9, radius: 2.0, height: 2.9, color: "#316632" },
      { y: 11.5, radius: 1.56, height: 2.5, color: "#2E6030" },
      { y: 12.9, radius: 1.14, height: 2.0, color: "#2B592C" },
      { y: 14.0, radius: 0.82, height: 1.6, color: "#285228" },
    ],
    canopyTwistRadians: Math.PI * 0.3,
    asymmetry: 0.1,
    trunkTopRadius: 0.028,
    trunkBottomRadius: 0.49,
    trunkTaperExponent: 2.6,
    trunkTopMargin: 0.42,
    trunkCanopyPenetration: 0.31,
  },
};

const TRUNK_COLLIDER_RADIUS_MULTIPLIER = 0.82;
const TRUNK_TOP_RATIO_MIN = 0.015;
const TRUNK_TOP_RATIO_MAX = 0.08;
const TRUNK_MIN_TOP_RADIUS = 0.008;
const TRUNK_RADIUS_HEIGHT_EXPONENT = 0.5;
const TALL_TREE_THICKNESS_REDUCTION_START = 1.05;
const TALL_TREE_THICKNESS_REDUCTION_END = 1.8;
const TALL_TREE_THICKNESS_MIN_SCALE = 0.82;
const TRUNK_RADIAL_SEGMENTS = 12;
const TRUNK_HEIGHT_SEGMENTS = 14;
const CANOPY_RADIAL_SEGMENTS = 14;
const CANOPY_HEIGHT_SEGMENTS = 2;
const SEED_PRIME_A = 127.1;
const SEED_PRIME_B = 311.7;
const SEED_PRIME_C = 74.7;
const CANOPY_WRAP_LIGHT_STRENGTH = 0.32;
const CANOPY_BACKSCATTER_STRENGTH = 0.14;
const CANOPY_BACKSCATTER_POWER = 2.6;
const CANOPY_TAPER_NORMAL_COMPENSATION = 1;
const CANOPY_SHADOW_RECEIVER_NORMAL_BIAS = 1.0;

type FoliageShaderUniforms = {
  foliageWrap: { value: number };
  foliageBackscatter: { value: number };
  foliageBackscatterPower: { value: number };
  foliageNormalCompensation: { value: number };
  foliageShadowReceiverBias: { value: number };
};

function hash(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
}

function getFallbackVariationSeed(
  position: readonly [number, number, number],
): number {
  return (
    position[0] * SEED_PRIME_A +
    position[1] * SEED_PRIME_C +
    position[2] * SEED_PRIME_B
  );
}

function createTopDownConeGeometry(): ConeGeometry {
  const geometry = new ConeGeometry(
    1,
    1,
    CANOPY_RADIAL_SEGMENTS,
    CANOPY_HEIGHT_SEGMENTS,
    true,
  );
  const positions = geometry.getAttribute("position") as BufferAttribute;
  const uvs = geometry.getAttribute("uv") as BufferAttribute;

  const uvScale = 0.333;
  const randomOffset = Math.round(Math.random() * 3);
  const pairs = [
    [0.55, 0.25],
    [0.28, 0.5],
    [0.75, 0.5],
    [0.5, 0.7],
  ];
  const [uCenter, vCenter] = pairs[randomOffset];

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    const u = (x / 2) * uvScale + uCenter;
    const v = (z / 2) * uvScale + vCenter;

    uvs.setXY(i, u, v);
  }

  uvs.needsUpdate = true;
  return geometry;
}

function createMonumentTaperedTrunkGeometry(
  topRadius: number,
  bottomRadius: number,
  height: number,
  taperExponent: number,
): CylinderGeometry {
  const geometry = new CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    TRUNK_RADIAL_SEGMENTS,
    TRUNK_HEIGHT_SEGMENTS,
    false,
  );
  const positions = geometry.getAttribute("position") as BufferAttribute;

  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
    const x = positions.getX(vertexIndex);
    const y = positions.getY(vertexIndex);
    const z = positions.getZ(vertexIndex);
    const radial = Math.hypot(x, z);
    if (radial < 1e-6) {
      continue;
    }

    const t = MathUtils.clamp(
      (y + height * 0.5) / Math.max(height, 1e-6),
      0,
      1,
    );
    const linearRadius = MathUtils.lerp(bottomRadius, topRadius, t);
    const curvedRadius =
      topRadius + (bottomRadius - topRadius) * (1 - Math.pow(t, taperExponent));
    const targetRadius = Math.max(curvedRadius, topRadius);
    const scale = targetRadius / Math.max(linearRadius, 1e-6);
    positions.setX(vertexIndex, x * scale);
    positions.setZ(vertexIndex, z * scale);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createSingleTreeShape(
  heightScale: number,
  species: SingleTreeSpecies,
  variationSeed: number,
): SingleTreeShape {
  const profile = SPECIES_SHAPE_PROFILES[species];
  const normalizedHeightScale = MathUtils.clamp(heightScale, 0.7, 1.8);
  const canopyRadiusScale = Math.pow(normalizedHeightScale, 0.72);
  const tallTreeThicknessBlend = MathUtils.smoothstep(
    normalizedHeightScale,
    TALL_TREE_THICKNESS_REDUCTION_START,
    TALL_TREE_THICKNESS_REDUCTION_END,
  );
  const tallTreeThicknessScale = MathUtils.lerp(
    1,
    TALL_TREE_THICKNESS_MIN_SCALE,
    tallTreeThicknessBlend,
  );
  const trunkRadiusScale =
    Math.pow(normalizedHeightScale, TRUNK_RADIUS_HEIGHT_EXPONENT) *
    tallTreeThicknessScale;

  const canopyLayers = profile.canopyLayers.map((layer, layerIndex) => {
    const layerSeed = variationSeed + (layerIndex + 1) * 73.17;
    const radiusJitter = MathUtils.lerp(0.84, 1.16, hash(layerSeed + 1.2));
    const heightJitter = MathUtils.lerp(0.88, 1.14, hash(layerSeed + 2.8));
    const normalizedLayer =
      layerIndex / Math.max(profile.canopyLayers.length - 1, 1);
    const asymmetryStrength =
      layer.radius *
      canopyRadiusScale *
      profile.asymmetry *
      (1 - normalizedLayer * 0.58) *
      MathUtils.lerp(0.45, 1, hash(layerSeed + 4.9));
    const asymmetryAngle = hash(layerSeed + 6.4) * Math.PI * 2;

    return {
      y: layer.y * normalizedHeightScale,
      x: Math.cos(asymmetryAngle) * asymmetryStrength,
      z: Math.sin(asymmetryAngle) * asymmetryStrength,
      height: layer.height * normalizedHeightScale * heightJitter,
      radius: layer.radius * canopyRadiusScale * radiusJitter,
      twist:
        normalizedLayer * profile.canopyTwistRadians +
        (hash(layerSeed + 8.7) - 0.5) * Math.PI * 0.38,
      color: layer.color,
    };
  });

  const canopyBounds = canopyLayers.reduce(
    (bounds, layer) => {
      const halfHeight = layer.height * 0.5;
      bounds.lowestBottom = Math.min(bounds.lowestBottom, layer.y - halfHeight);
      bounds.highestTop = Math.max(bounds.highestTop, layer.y + halfHeight);
      return bounds;
    },
    { lowestBottom: Infinity, highestTop: -Infinity },
  );

  const topMargin = profile.trunkTopMargin * normalizedHeightScale;
  const minimumReachIntoCanopy = 0.75 * normalizedHeightScale;
  const topY = canopyBounds.highestTop - topMargin;
  const trunkHeight = Math.max(
    canopyBounds.lowestBottom + minimumReachIntoCanopy,
    topY,
  );
  const trunkBottomRadius =
    profile.trunkBottomRadius *
    trunkRadiusScale *
    MathUtils.lerp(0.92, 1.12, hash(variationSeed + 21.4));
  const trunkTopRadiusBase =
    profile.trunkTopRadius *
    trunkRadiusScale *
    MathUtils.lerp(0.82, 1.03, hash(variationSeed + 15.6));
  const trunkTopRadius = Math.max(
    trunkTopRadiusBase,
    trunkBottomRadius *
      MathUtils.lerp(
        TRUNK_TOP_RATIO_MIN,
        TRUNK_TOP_RATIO_MAX,
        hash(variationSeed + 25.3),
      ),
    TRUNK_MIN_TOP_RADIUS,
  );

  return {
    normalizedHeightScale,
    canopyLayers,
    canopyBounds,
    trunkDimensions: {
      height: trunkHeight,
      y: trunkHeight * 0.5,
    },
    trunkRadii: {
      top: trunkTopRadius,
      bottom: trunkBottomRadius,
    },
  };
}

export function getSingleTreeTrunkCollider(
  heightScale = 1,
  species: SingleTreeSpecies = "pine",
  variationSeed = 0,
): SingleTreeTrunkCollider {
  const { normalizedHeightScale, canopyBounds, trunkDimensions, trunkRadii } =
    createSingleTreeShape(heightScale, species, variationSeed);
  const profile = SPECIES_SHAPE_PROFILES[species];
  const colliderTopY = Math.min(
    trunkDimensions.height,
    canopyBounds.lowestBottom +
      profile.trunkCanopyPenetration * normalizedHeightScale,
  );
  const colliderHeight = Math.max(colliderTopY, 0.1);

  return {
    halfHeight: colliderHeight * 0.5,
    centerY: colliderHeight * 0.5,
    radius: Math.max(
      trunkRadii.bottom * TRUNK_COLLIDER_RADIUS_MULTIPLIER,
      0.05,
    ),
  };
}

export function getSingleTreeFootprintRadius(
  heightScale = 1,
  species: SingleTreeSpecies = "pine",
  variationSeed = 0,
): number {
  const { canopyLayers, trunkRadii } = createSingleTreeShape(
    heightScale,
    species,
    variationSeed,
  );
  const canopyFootprintRadius = canopyLayers.reduce((radius, layer) => {
    return Math.max(radius, Math.hypot(layer.x, layer.z) + layer.radius);
  }, 0);

  return Math.max(canopyFootprintRadius, trunkRadii.bottom);
}

export type BuiltSingleTree = {
  group: Group;
  trunkGeometry: CylinderGeometry;
  trunkCollider: SingleTreeTrunkCollider;
};

export class SingleTreeFactory {
  private readonly canopyGeometry = createTopDownConeGeometry();
  private readonly trunkMaterials = new Map<
    SingleTreeSpecies,
    MeshStandardMaterial
  >();
  private readonly canopyMaterials = new Map<string, MeshStandardMaterial>();

  constructor(
    private readonly treeBarkTexture?: Texture,
    private readonly pineFoliageTexture?: Texture,
  ) {}

  createTree({
    position,
    heightScale = 1,
    species = "pine",
    variationSeed,
  }: SingleTreeProps): BuiltSingleTree {
    const resolvedSeed = variationSeed ?? getFallbackVariationSeed(position);
    const treeShape = createSingleTreeShape(heightScale, species, resolvedSeed);
    const { canopyLayers, trunkDimensions, trunkRadii } = treeShape;
    const trunkTaperExponent =
      SPECIES_SHAPE_PROFILES[species].trunkTaperExponent;

    const trunkMaterial = this.getTrunkMaterial(species);
    const trunkGeometry = createMonumentTaperedTrunkGeometry(
      trunkRadii.top,
      trunkRadii.bottom,
      trunkDimensions.height,
      trunkTaperExponent,
    );

    const group = new Group();
    group.position.set(position[0], position[1], position[2]);

    const trunkMesh = new Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.position.set(0, trunkDimensions.y, 0);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    group.add(trunkMesh);

    for (const layer of canopyLayers) {
      const canopyMaterial = this.getCanopyMaterial(layer.color);
      const canopyGeometry = createTopDownConeGeometry();
      const canopyMesh = new Mesh(canopyGeometry, canopyMaterial);
      canopyMesh.position.set(layer.x, layer.y, layer.z);
      canopyMesh.rotation.set(0, layer.twist, 0);
      canopyMesh.scale.set(layer.radius, layer.height, layer.radius);
      canopyMesh.castShadow = true;
      canopyMesh.receiveShadow = true;
      group.add(canopyMesh);
    }

    return {
      group,
      trunkGeometry,
      trunkCollider: getSingleTreeTrunkCollider(
        heightScale,
        species,
        resolvedSeed,
      ),
    };
  }

  dispose(): void {
    this.canopyGeometry.dispose();
    for (const material of this.trunkMaterials.values()) {
      material.dispose();
    }
    for (const material of this.canopyMaterials.values()) {
      material.dispose();
    }
  }

  private getTrunkMaterial(species: SingleTreeSpecies): MeshStandardMaterial {
    const existing = this.trunkMaterials.get(species);
    if (existing) {
      return existing;
    }

    let baseColor = "#A48A73"; // fir
    if (species === "redwood") baseColor = "#B08A6E";
    if (species === "pine") baseColor = "#B49E88";

    const material = new MeshStandardMaterial({
      color: baseColor,
      roughness: 0.75,
      metalness: 0.02,
      map: this.treeBarkTexture || null,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.trunkWrap = { value: 0.25 };
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", trunkFragmentCommon())
        .replace("#include <lights_fragment_begin>", trunkLightsFragmentBegin());
    };
    material.customProgramCacheKey = () => "single-tree-trunk-v2";

    this.trunkMaterials.set(species, material);
    return material;
  }

  private getCanopyMaterial(color: string): MeshStandardMaterial {
    const existing = this.canopyMaterials.get(color);
    if (existing) {
      return existing;
    }

    const material = new MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.0,
      side: DoubleSide,
      shadowSide: DoubleSide,
      map: this.pineFoliageTexture || null,
      alphaTest: this.pineFoliageTexture ? 0.5 : 0,
      transparent: true,
    });

    if (this.pineFoliageTexture) {
      material.onBeforeCompile = (shader) => {
        const uniforms = shader.uniforms as typeof shader.uniforms &
          FoliageShaderUniforms;

        uniforms.foliageWrap = { value: CANOPY_WRAP_LIGHT_STRENGTH };
        uniforms.foliageBackscatter = { value: CANOPY_BACKSCATTER_STRENGTH };
        uniforms.foliageBackscatterPower = { value: CANOPY_BACKSCATTER_POWER };
        uniforms.foliageNormalCompensation = {
          value: CANOPY_TAPER_NORMAL_COMPENSATION,
        };
        uniforms.foliageShadowReceiverBias = {
          value: CANOPY_SHADOW_RECEIVER_NORMAL_BIAS,
        };

        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", canopyVertexCommon())
          .replace("#include <defaultnormal_vertex>", canopyDefaultNormalVertex())
          .replace("#include <shadowmap_vertex>", canopyShadowMapVertex());

        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", canopyFragmentCommon())
          .replace("#include <map_fragment>", canopyMapFragment())
          .replace("#include <lights_fragment_begin>", canopyLightsFragmentBegin());
      };
      material.customProgramCacheKey = () => "single-tree-canopy-foliage-v8";
    }

    this.canopyMaterials.set(color, material);
    return material;
  }
}
