import { Howl, Howler } from "howler";
import { RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from "three";
import { CONFIG } from "../game/Config";
import { delay } from "../util/Time";

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
    "/simplex-noise.png",
    "/cloud.png",
    "/grassleaf.png",
    "/accentleaf.png",
    "/dirt_path.png",
    "/tree_bark.png",
    "/pine_tree_canopy_foliage.png",
    "/hilly_grass.png",
    "/rocky_mountain.png",
    "/wooden_plank.png",
    "/brushed_steel_rail.png",
    "/dark_brushed_metal.png",
    "/knurled_metal.png",
    "/concrete_platform.png",
    "/corrugated_metal_roof.png",
    "/red_painted_metal.png",
    "/brick_station_wall.png",
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

export async function warmupAudioContext(): Promise<void> {
  const audioContext = Howler.ctx;
  if (audioContext.state !== "running") {
    await audioContext.resume();
  }

  const silentBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
  const source = audioContext.createBufferSource();
  source.buffer = silentBuffer;
  source.connect(audioContext.destination);
  source.start(0);
}

export async function primeHowlForInstantPlayback(howl: Howl): Promise<void> {
  await ensureHowlLoaded(howl);
  const soundId = howl.play();
  if (soundId === undefined) {
    return;
  }
  howl.volume(0.001, soundId);
  await delay(50);
  howl.stop(soundId);
}

function loadTexture(src: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    TEXTURE_LOADER.load(
      src,
      (texture) => resolve(texture),
      undefined,
      () => reject(new Error(`Failed to preload texture: ${src}`)),
    );
  });
}

function loadHowl(src: string): Promise<Howl> {
  const howl = new Howl({
    src: [src],
    preload: true,
    html5: false,
  });

  return ensureHowlLoaded(howl).then(() => howl);
}

export function ensureHowlLoaded(howl: Howl): Promise<void> {
  if (howl.state() === "loaded") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onLoad = (): void => {
      howl.off("loaderror", onLoadError);
      resolve();
    };
    const onLoadError = (_soundId: number, error: unknown): void => {
      howl.off("load", onLoad);
      howl.unload();
      reject(new Error(`Failed to preload audio (${String(error)})`));
    };

    howl.once("load", onLoad);
    howl.once("loaderror", onLoadError);
  });
}
