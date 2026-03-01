import { Howl } from "howler";
import { RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from "three";
import { ASSETS_CDN_BASE, CONFIG } from "@/game/Config";

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

  const textureSrcs = CONFIG.textures;

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

  const [musicTrack1Howl, ...loadedTextures] = await Promise.all([
    track(loadHowl(firstMusicTrackSrc)),
    ...textureSrcs.map((src) => track(loadTexture(src))),
  ]);

  loadedTextures.forEach(wrapTexture);

  const [
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
  ] = loadedTextures;

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

function wrapTexture(texture: Texture): Texture {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
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
