import { Howl } from "howler";
import { RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from "three";
import { ASSETS_CDN_BASE, CONFIG } from "../game/Config";

export type CriticalPreloadedAssets = {
  movementHowls: Howl[];
  brakeHowls: Howl[];
  ambientHowls: Howl[];
  musicTrack1Howl: Howl;
  simplexNoiseTexture: Texture;
  cloudTexture: Texture;
  grassLeafTexture: Texture;
  grassAccentTexture: Texture;
  dirtPathTexture: Texture;
  treeBarkTexture: Texture;
  pineFoliageTexture: Texture;
  hillyGrassTexture: Texture;
  rockyMountainTexture: Texture;
  woodenPlankTexture: Texture;
  railTexture: Texture;
  darkBrushedMetalTexture: Texture;
  knurledMetalTexture: Texture;
  concretePlatformTexture: Texture;
  corrugatedMetalRoofTexture: Texture;
  redPaintedMetalTexture: Texture;
  brickStationWallTexture: Texture;
};

type ProgressCallback = (progress: number) => void;

const TEXTURE_LOADER = new TextureLoader();

export async function preloadCriticalAssets(
  onProgress?: ProgressCallback,
): Promise<CriticalPreloadedAssets> {
  const firstMusicTrackSrc = CONFIG.audio.musicTrackSrcs[0];
  if (!firstMusicTrackSrc) {
    throw new Error("Missing first music track source for critical preload.");
  }

  const textureSrcs = [
    "/textures/simplex-noise.png",
    "/textures/cloud.png",
    "/textures/grassleaf.png",
    "/textures/accentleaf.png",
    "/textures/dirt_path.png",
    "/textures/tree_bark.png",
    "/textures/pine_tree_canopy_foliage.png",
    "/textures/hilly_grass.png",
    "/textures/rocky_mountain.png",
    "/textures/wooden_plank.png",
    "/textures/brushed_steel_rail.png",
    "/textures/dark_brushed_metal.png",
    "/textures/knurled_metal.png",
    "/textures/concrete_platform.png",
    "/textures/corrugated_metal_roof.png",
    "/textures/red_painted_metal.png",
    "/textures/brick_station_wall.png",
  ];

  const totalAssets =
    CONFIG.audio.movementTrackSrcs.length +
    CONFIG.audio.brakeTrackSrcs.length +
    CONFIG.audio.ambientTrackSrcs.length +
    1 + // first music track
    textureSrcs.length;

  let completedAssets = 0;
  onProgress?.(0);

  function track<T>(promise: Promise<T>): Promise<T> {
    return promise.then(
      (value) => {
        completedAssets += 1;
        onProgress?.(Math.min(1, completedAssets / totalAssets));
        return value;
      },
      (error) => {
        completedAssets += 1;
        onProgress?.(Math.min(1, completedAssets / totalAssets));
        throw error;
      },
    );
  }

  const movementHowls = await Promise.all(
    CONFIG.audio.movementTrackSrcs.map((src) => track(loadHowl(src))),
  );
  const brakeHowls = await Promise.all(
    CONFIG.audio.brakeTrackSrcs.map((src) => track(loadHowl(src))),
  );
  const ambientHowls = await Promise.all(
    CONFIG.audio.ambientTrackSrcs.map((src) => track(loadHowl(src))),
  );

  const [
    musicTrack1Howl,
    simplexNoiseTexture,
    cloudTexture,
    grassLeafTexture,
    grassAccentTexture,
    dirtPathTexture,
    treeBarkTexture,
    pineFoliageTexture,
    hillyGrassTexture,
    rockyMountainTexture,
    woodenPlankTexture,
    railTexture,
    darkBrushedMetalTexture,
    knurledMetalTexture,
    concretePlatformTexture,
    corrugatedMetalRoofTexture,
    redPaintedMetalTexture,
    brickStationWallTexture,
  ] = await Promise.all([
    track(loadHowl(firstMusicTrackSrc)),
    ...textureSrcs.map((src) => track(loadTexture(src))),
  ]);

  simplexNoiseTexture.wrapS = RepeatWrapping;
  simplexNoiseTexture.wrapT = RepeatWrapping;
  cloudTexture.colorSpace = SRGBColorSpace;
  grassLeafTexture.colorSpace = SRGBColorSpace;
  grassAccentTexture.colorSpace = SRGBColorSpace;
  dirtPathTexture.colorSpace = SRGBColorSpace;
  dirtPathTexture.wrapS = RepeatWrapping;
  dirtPathTexture.wrapT = RepeatWrapping;
  treeBarkTexture.colorSpace = SRGBColorSpace;
  treeBarkTexture.wrapS = RepeatWrapping;
  treeBarkTexture.wrapT = RepeatWrapping;
  pineFoliageTexture.colorSpace = SRGBColorSpace;
  pineFoliageTexture.wrapS = RepeatWrapping;
  pineFoliageTexture.wrapT = RepeatWrapping;
  hillyGrassTexture.colorSpace = SRGBColorSpace;
  hillyGrassTexture.wrapS = RepeatWrapping;
  hillyGrassTexture.wrapT = RepeatWrapping;
  rockyMountainTexture.colorSpace = SRGBColorSpace;
  rockyMountainTexture.wrapS = RepeatWrapping;
  rockyMountainTexture.wrapT = RepeatWrapping;
  woodenPlankTexture.colorSpace = SRGBColorSpace;
  woodenPlankTexture.wrapS = RepeatWrapping;
  woodenPlankTexture.wrapT = RepeatWrapping;
  railTexture.colorSpace = SRGBColorSpace;
  railTexture.wrapS = RepeatWrapping;
  railTexture.wrapT = RepeatWrapping;
  darkBrushedMetalTexture.colorSpace = SRGBColorSpace;
  darkBrushedMetalTexture.wrapS = RepeatWrapping;
  darkBrushedMetalTexture.wrapT = RepeatWrapping;
  knurledMetalTexture.colorSpace = SRGBColorSpace;
  knurledMetalTexture.wrapS = RepeatWrapping;
  knurledMetalTexture.wrapT = RepeatWrapping;
  concretePlatformTexture.colorSpace = SRGBColorSpace;
  concretePlatformTexture.wrapS = RepeatWrapping;
  concretePlatformTexture.wrapT = RepeatWrapping;
  corrugatedMetalRoofTexture.colorSpace = SRGBColorSpace;
  corrugatedMetalRoofTexture.wrapS = RepeatWrapping;
  corrugatedMetalRoofTexture.wrapT = RepeatWrapping;
  redPaintedMetalTexture.colorSpace = SRGBColorSpace;
  redPaintedMetalTexture.wrapS = RepeatWrapping;
  redPaintedMetalTexture.wrapT = RepeatWrapping;
  brickStationWallTexture.colorSpace = SRGBColorSpace;
  brickStationWallTexture.wrapS = RepeatWrapping;
  brickStationWallTexture.wrapT = RepeatWrapping;

  return {
    movementHowls,
    brakeHowls,
    ambientHowls,
    musicTrack1Howl,
    simplexNoiseTexture,
    cloudTexture,
    grassLeafTexture,
    grassAccentTexture,
    dirtPathTexture,
    treeBarkTexture,
    pineFoliageTexture,
    hillyGrassTexture,
    rockyMountainTexture,
    woodenPlankTexture,
    railTexture,
    darkBrushedMetalTexture,
    knurledMetalTexture,
    concretePlatformTexture,
    corrugatedMetalRoofTexture,
    redPaintedMetalTexture,
    brickStationWallTexture,
  };
}

function loadTexture(src: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    TEXTURE_LOADER.load(
      ASSETS_CDN_BASE + src,
      (texture) => resolve(texture),
      undefined,
      () => reject(new Error(`Failed to preload texture: ${src}`)),
    );
  });
}

function loadHowl(src: string): Promise<Howl> {
  return new Promise((resolve, reject) => {
    const howl = new Howl({
      src: [src],
      preload: true,
      html5: false,
    });

    howl.once("load", () => resolve(howl));
    howl.once("loaderror", () =>
      reject(new Error(`Failed to preload audio: ${src}`)),
    );
  });
}
