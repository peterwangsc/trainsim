import { Howl } from "howler";
import { clamp } from "../util/Math";
import {
  ensureHowlLoaded,
  primeHowlForInstantPlayback,
} from "../loading/CriticalAssetPreloader";

export type GameMusicConfig = {
  tracks: readonly string[];
  preloadedFirstTrackHowl: Howl;
  volume: number;
  fadeInMs: number;
  // How many ms into the track to begin fading out. Set this well before
  // any hard cut-off point at the end of the file.
  fadeOutAtMs: number;
  fadeOutMs: number;
  // Silence between tracks, in ms.
  gapMs: number;
};

export class GameMusic {
  private currentHowl: Howl | null = null;
  private readonly pendingTimers = new Map<
    ReturnType<typeof setTimeout>,
    () => void
  >();
  private readonly tracks: readonly string[];
  private readonly howls: Array<Howl | null>;
  private readonly loadPromises = new Map<number, Promise<Howl>>();
  private isActive = false;
  private currentTrackIndex = 0;
  private playbackRunToken = 0;
  private prefetchRunToken = 0;
  private readonly volume: number;
  private readonly fadeInMs: number;
  private readonly fadeOutAtMs: number;
  private readonly fadeOutMs: number;
  private readonly gapMs: number;

  constructor(config: GameMusicConfig) {
    if (config.tracks.length === 0) {
      throw new Error("GameMusic requires at least one track.");
    }

    this.volume = clamp(config.volume, 0, 1);
    this.tracks = config.tracks;
    this.howls = Array.from({ length: this.tracks.length }, () => null);
    this.howls[0] = config.preloadedFirstTrackHowl;
    this.fadeInMs = config.fadeInMs;
    this.fadeOutAtMs = config.fadeOutAtMs;
    this.fadeOutMs = config.fadeOutMs;
    this.gapMs = config.gapMs;
  }

  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;
    this.currentTrackIndex = 0;
    this.playbackRunToken += 1;
    const runToken = this.playbackRunToken;
    this.prefetchRunToken = runToken;

    let firstTrackHowl: Howl;
    try {
      firstTrackHowl = await this.ensureTrackHowlLoaded(0);
    } catch (error) {
      console.error("Failed to load first music track.", error);
      this.isActive = false;
      return;
    }

    if (!this.isRunActive(runToken)) {
      return;
    }

    void this.prefetchUpcomingTracks(runToken);

    try {
      await primeHowlForInstantPlayback(firstTrackHowl);
    } catch (error) {
      console.warn("Music priming failed; continuing without priming.", error);
    }
    if (!this.isRunActive(runToken)) {
      return;
    }

    void this.playbackLoop(runToken);
  }

  stop(): void {
    this.isActive = false;
    this.playbackRunToken += 1;
    this.prefetchRunToken += 1;
    this.clearTimers();
    this.currentTrackIndex = 0;
    if (this.currentHowl) {
      this.releaseHowl(this.currentHowl);
      this.currentHowl = null;
    }
  }

  dispose(): void {
    this.stop();
    for (let i = 0; i < this.howls.length; i++) {
      const howl = this.howls[i];
      if (!howl) {
        continue;
      }
      howl.off();
      howl.stop();
      if (i !== 0) {
        howl.unload();
      }
    }
    this.howls.fill(null);
    this.loadPromises.clear();
  }

  private isRunActive(runToken: number): boolean {
    return this.isActive && this.playbackRunToken === runToken;
  }

  private async playbackLoop(runToken: number): Promise<void> {
    while (this.isRunActive(runToken)) {
      const trackIndex = this.currentTrackIndex;
      let howl: Howl;

      try {
        howl = await this.ensureTrackHowlLoaded(trackIndex);
      } catch (error) {
        console.error(
          `Failed to load music track for playback: ${this.tracks[trackIndex]}`,
          error,
        );
        if (!this.isRunActive(runToken)) {
          return;
        }
        await this.wait(this.gapMs);
        if (!this.isRunActive(runToken)) {
          return;
        }
        this.currentTrackIndex = (trackIndex + 1) % this.tracks.length;
        continue;
      }

      if (!this.isRunActive(runToken)) {
        return;
      }

      await this.playTrackLifecycle(howl, runToken);
      if (!this.isRunActive(runToken)) {
        return;
      }
      this.currentTrackIndex = (trackIndex + 1) % this.tracks.length;
    }
  }

  private async playTrackLifecycle(howl: Howl, runToken: number): Promise<void> {
    if (!this.isRunActive(runToken)) {
      return;
    }

    if (this.currentHowl && this.currentHowl !== howl) {
      this.releaseHowl(this.currentHowl);
    }
    this.currentHowl = howl;

    howl.off();
    howl.stop();
    howl.seek(0);
    howl.volume(0);

    const soundId = howl.play();
    if (soundId === undefined) {
      return;
    }
    howl.fade(0, this.volume, this.fadeInMs, soundId);

    await this.wait(this.fadeOutAtMs);
    if (!this.isRunActive(runToken) || this.currentHowl !== howl) {
      return;
    }
    howl.fade(howl.volume(soundId) as number, 0, this.fadeOutMs, soundId);

    await this.wait(this.fadeOutMs);
    if (!this.isRunActive(runToken) || this.currentHowl !== howl) {
      return;
    }

    this.releaseHowl(howl);
    this.currentHowl = null;
    await this.wait(this.gapMs);
  }

  private async prefetchUpcomingTracks(runToken: number): Promise<void> {
    for (let index = 1; index < this.tracks.length; index += 1) {
      if (!this.isRunActive(runToken) || this.prefetchRunToken !== runToken) {
        return;
      }

      try {
        await this.ensureTrackHowlLoaded(index);
      } catch (error) {
        console.warn(
          `Background music prefetch failed for ${this.tracks[index]}.`,
          error,
        );
      }
    }
  }

  private ensureTrackHowlLoaded(index: number): Promise<Howl> {
    if (index < 0 || index >= this.tracks.length) {
      throw new Error(`Track index out of bounds: ${index}`);
    }

    const existingPromise = this.loadPromises.get(index);
    if (existingPromise) {
      return existingPromise;
    }

    let howl = this.howls[index];
    if (!howl) {
      howl = new Howl({
        src: [this.tracks[index]],
        preload: true,
        html5: false,
        volume: 0,
      });
      this.howls[index] = howl;
    }

    if (howl.state() === "loaded") {
      return Promise.resolve(howl);
    }

    const loadPromise = ensureHowlLoaded(howl)
      .then(() => howl as Howl)
      .catch((error) => {
        howl.off();
        howl.unload();
        if (this.howls[index] === howl) {
          this.howls[index] = null;
        }
        throw error;
      })
      .finally(() => {
        this.loadPromises.delete(index);
      });

    this.loadPromises.set(index, loadPromise);
    return loadPromise;
  }

  private wait(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        resolve();
      }, ms);

      this.pendingTimers.set(timer, () => {
        this.pendingTimers.delete(timer);
        resolve();
      });
    });
  }

  private clearTimers(): void {
    for (const [timer, resolve] of this.pendingTimers) {
      clearTimeout(timer);
      resolve();
    }
    this.pendingTimers.clear();
  }

  private releaseHowl(howl: Howl): void {
    howl.off();
    howl.stop();
    howl.volume(0);
    howl.seek(0);
  }
}
