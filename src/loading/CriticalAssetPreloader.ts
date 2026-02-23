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

  const totalAssets =
    CONFIG.audio.movementTrackSrcs.length +
    CONFIG.audio.brakeTrackSrcs.length +
    CONFIG.audio.ambientTrackSrcs.length +
    1 +
    4;
  let completedAssets = 0;
  onProgress?.(0);

  const step = (): void => {
    completedAssets += 1;
    onProgress?.(Math.min(1, completedAssets / totalAssets));
  };

  const track = <T>(promise: Promise<T>): Promise<T> =>
    promise.then(
      (value) => {
        step();
        return value;
      },
      (error) => {
        step();
        throw error;
      },
    );

  const movementHowlsPromise = Promise.all(
    CONFIG.audio.movementTrackSrcs.map((src) => track(loadHowl(src))),
  );
  const brakeHowlsPromise = Promise.all(
    CONFIG.audio.brakeTrackSrcs.map((src) => track(loadHowl(src))),
  );
  const ambientHowlsPromise = Promise.all(
    CONFIG.audio.ambientTrackSrcs.map((src) => track(loadHowl(src))),
  );
  const musicTrack1HowlPromise = track(loadHowl(firstMusicTrackSrc));
  const simplexNoiseTexturePromise = track(loadTexture("/simplex-noise.png"));
  const cloudTexturePromise = track(loadTexture("/cloud.png"));
  const grassLeafTexturePromise = track(loadTexture("/grassleaf.png"));
  const grassAccentTexturePromise = track(loadTexture("/accentleaf.png"));

  const [
    movementHowls,
    brakeHowls,
    ambientHowls,
    musicTrack1Howl,
    simplexNoiseTexture,
    cloudTexture,
    grassLeafTexture,
    grassAccentTexture,
  ] = await Promise.all([
    movementHowlsPromise,
    brakeHowlsPromise,
    ambientHowlsPromise,
    musicTrack1HowlPromise,
    simplexNoiseTexturePromise,
    cloudTexturePromise,
    grassLeafTexturePromise,
    grassAccentTexturePromise,
  ]);

  simplexNoiseTexture.wrapS = RepeatWrapping;
  simplexNoiseTexture.wrapT = RepeatWrapping;
  cloudTexture.colorSpace = SRGBColorSpace;
  grassLeafTexture.colorSpace = SRGBColorSpace;
  grassAccentTexture.colorSpace = SRGBColorSpace;

  return {
    movementHowls,
    brakeHowls,
    ambientHowls,
    musicTrack1Howl,
    simplexNoiseTexture,
    cloudTexture,
    grassLeafTexture,
    grassAccentTexture,
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
  await delay(50);
  source.start(0);
}

export async function primeHowlForInstantPlayback(howl: Howl): Promise<void> {
  await ensureHowlLoaded(howl);
  const soundId = howl.play();
  if (soundId === undefined) {
    return;
  }
  howl.volume(0, soundId);
  howl.pause(soundId);
  howl.seek(0, soundId);
  await delay(100);
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
    volume: 0,
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
