import { Howl } from "howler";
import { clamp } from "../util/Math";

export type RandomAmbientAudioConfig = {
  tracks: readonly string[];
  volume: number;
  // Range of silence between plays, in milliseconds.
  minGapMs: number;
  maxGapMs: number;
};

// Fade duration at the start and end of each play, in milliseconds.
const FADE_MS = 2000;

export class RandomAmbientAudio {
  private currentHowl: Howl | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private currentTrackIndex = -1;
  private readonly volume: number;
  private readonly tracks: readonly string[];
  private readonly minGapMs: number;
  private readonly maxGapMs: number;

  constructor(config: RandomAmbientAudioConfig) {
    this.volume = clamp(config.volume, 0, 0.2);
    this.tracks = config.tracks;
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
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  }

  dispose(): void {
    this.stop();
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

    const howl = new Howl({
      src: [this.tracks[nextIndex]],
      volume: 0, // fade in from silence
      html5: true, // Stream instead of decoding into memory — volume is writable on all modern iOS
      onplay: () => {
        if (!this.isActive) {
          howl.stop();
          howl.unload();
          return;
        }
        howl.fade(0, this.volume, FADE_MS);
        this.scheduleFadeOut(howl);
      },
      onend: () => {
        // Fallback: fires only if scheduleFadeOut couldn't determine duration.
        if (this.currentHowl === howl) this.currentHowl = null;
        howl.unload();
        if (this.isActive) this.scheduleNext();
      },
    });

    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
    }
    this.currentHowl = howl;
    howl.play();
  }

  // Schedule a fade-out to begin FADE_MS before the track's natural end.
  // Falls back to onend if the duration isn't available (some HTTP streams).
  private scheduleFadeOut(howl: Howl): void {
    const durationSec = howl.duration();
    if (!durationSec || !isFinite(durationSec) || durationSec <= 0) return;

    const elapsedMs = (howl.seek() as number) * 1000;
    const delay = durationSec * 1000 - elapsedMs - FADE_MS;
    if (delay <= 0) {
      this.beginFadeOut(howl);
      return;
    }

    this.fadeOutTimer = setTimeout(() => {
      if (this.isActive && this.currentHowl === howl) this.beginFadeOut(howl);
    }, delay);
  }

  private beginFadeOut(howl: Howl): void {
    howl.off("end"); // prevent onend from double-triggering scheduleNext
    howl.fade(howl.volume() as number, 0, FADE_MS);
    setTimeout(() => {
      howl.stop();
      howl.unload();
      if (this.currentHowl === howl) this.currentHowl = null;
      if (this.isActive) this.scheduleNext();
    }, FADE_MS);
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
