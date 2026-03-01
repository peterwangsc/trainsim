import { Howl } from "howler";
import { clamp } from "@/util/Math";

export type GameMusicConfig = {
  tracks: readonly string[];
  preloadedFirstTrackHowl: Howl;
  volume: number;
  // Silence between tracks, in ms.
  gapMs: number;
};

export class GameMusic {
  private currentHowl: Howl | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private currentTrackIndex = 0;
  private readonly volume: number;
  private volumeScale: number = 1.0;
  private readonly tracks: readonly string[];
  private readonly howls: Array<Howl>;
  private readonly gapMs: number;

  constructor(config: GameMusicConfig) {
    if (config.tracks.length === 0) {
      throw new Error("GameMusic requires at least one track.");
    }

    this.volume = clamp(config.volume, 0, 1);
    this.tracks = config.tracks;
    this.howls = config.tracks.map((track, index) => {
      if (index === 0) return config.preloadedFirstTrackHowl;
      return new Howl({
        src: [track],
        preload: true,
        html5: false,
      });
    });
    this.gapMs = config.gapMs;
  }

  get effectiveVolume(): number {
    return this.volume * this.volumeScale;
  }

  setVolumeScale(scale: number): void {
    const wasVolume = this.effectiveVolume;
    this.volumeScale = scale;
    if (this.currentHowl && Math.abs(wasVolume - this.effectiveVolume) > 0.001) {
      this.currentHowl.volume(this.effectiveVolume);
    }
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.currentTrackIndex = 0;
    this.playCurrentTrack();
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
    for (let i = 0; i < this.howls.length; i++) {
      const howl = this.howls[i];
      howl.off();
      howl.stop();
      if (i !== 0) {
        howl.unload();
      }
    }
  }

  private clearTimers(): void {
    if (this.gapTimer !== null) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  private scheduleNext(): void {
    this.gapTimer = setTimeout(() => {
      if (this.isActive) {
        this.currentTrackIndex =
          (this.currentTrackIndex + 1) % this.tracks.length;
        this.playCurrentTrack();
      }
    }, this.gapMs);
  }

  private playCurrentTrack(): void {
    if (!this.isActive || this.tracks.length === 0) return;

    const howl = this.howls[this.currentTrackIndex];

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
      howl.volume(this.effectiveVolume, soundId);
    });

    howl.once("end", () => {
      if (this.isActive && this.currentHowl === howl) {
        this.currentHowl = null;
        this.scheduleNext();
      }
    });

    howl.play();
  }

  private resetHowl(howl: Howl): void {
    howl.off();
    howl.stop();
    howl.seek(0);
  }
}
