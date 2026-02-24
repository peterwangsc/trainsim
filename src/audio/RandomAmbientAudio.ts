import { Howl } from "howler";
import { clamp } from "../util/Math";

export type RandomAmbientAudioConfig = {
  tracks: readonly string[];
  preloadedHowls: Howl[];
  volume: number;
  // Range of silence between plays, in milliseconds.
  minGapMs: number;
  maxGapMs: number;
};

// Fade duration at the start and end of each play, in milliseconds.
const FADE_MS = 500;

export class RandomAmbientAudio {
  private currentHowl: Howl | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private currentTrackIndex = -1;
  private readonly volume: number;
  private readonly tracks: readonly string[];
  private readonly preloadedHowls: Howl[];
  private readonly minGapMs: number;
  private readonly maxGapMs: number;

  constructor(config: RandomAmbientAudioConfig) {
    if (config.preloadedHowls.length !== config.tracks.length) {
      throw new Error(
        "RandomAmbientAudio requires preloaded howls for every track.",
      );
    }

    this.volume = clamp(config.volume, 0, 0.2);
    this.tracks = config.tracks;
    this.preloadedHowls = config.preloadedHowls;
    this.minGapMs = config.minGapMs;
    this.maxGapMs = config.maxGapMs;
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.scheduleNext();
  }

  stop(): void {
    this.isActive = false;
    this.clearTimers();
    if (this.currentHowl) {
      this.resetHowl(this.currentHowl);
      this.currentHowl = null;
    }
  }

  dispose(): void {
    this.stop();
    for (const howl of this.preloadedHowls) {
      howl.off();
      howl.stop();
    }
  }

  private clearTimers(): void {
    if (this.gapTimer !== null) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
  }

  private scheduleNext(): void {
    const gap = this.minGapMs + Math.random() * (this.maxGapMs - this.minGapMs);
    this.gapTimer = setTimeout(() => {
      if (this.isActive) this.playOnce();
    }, gap);
  }

  private playOnce(): void {
    if (!this.isActive || this.tracks.length === 0) return;

    const nextIndex = this.pickNextTrackIndex();
    this.currentTrackIndex = nextIndex;
    const howl = this.preloadedHowls[nextIndex];

    if (this.currentHowl && this.currentHowl !== howl) {
      this.resetHowl(this.currentHowl);
    }
    this.currentHowl = howl;

    howl.off();
    howl.stop();
    howl.seek(0);

    howl.once("play", (soundId: number) => {
      if (!this.isActive || this.currentHowl !== howl) {
        return;
      }
      howl.volume(0, soundId);
      howl.fade(0, this.volume, FADE_MS, soundId);
      this.scheduleFadeOut(howl, soundId);
    });

    howl.play();
  }

  private scheduleFadeOut(howl: Howl, soundId: number): void {
    const durationSec = howl.duration();
    const elapsedMs = (howl.seek() as number) * 1000;
    const delay = durationSec * 1000 - elapsedMs - FADE_MS;
    if (delay <= 0) {
      this.beginFadeOut(howl, soundId);
      return;
    }

    this.fadeOutTimer = setTimeout(() => {
      if (this.isActive && this.currentHowl === howl)
        this.beginFadeOut(howl, soundId);
    }, delay);
  }

  private beginFadeOut(howl: Howl, soundId: number): void {
    howl.fade(this.volume, 0, FADE_MS, soundId);
    setTimeout(() => {
      this.resetHowl(howl);
      if (this.currentHowl === howl) this.currentHowl = null;
      if (this.isActive) this.scheduleNext();
    }, FADE_MS);
  }

  private resetHowl(howl: Howl): void {
    howl.off();
    howl.stop();
    howl.seek(0);
  }

  private pickNextTrackIndex(): number {
    const count = this.tracks.length;
    if (count <= 1) return 0;

    let index = Math.floor(Math.random() * count);
    if (index === this.currentTrackIndex) {
      index = (index + 1) % count;
    }
    return index;
  }
}
