import { Howl } from "howler";
import { clamp } from "../util/Math";

export type GameMusicConfig = {
  tracks: readonly string[];
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
  private timers: ReturnType<typeof setTimeout>[] = [];
  private isActive = false;
  private currentTrackIndex = 0;
  private readonly volume: number;
  private readonly tracks: readonly string[];
  private readonly fadeInMs: number;
  private readonly fadeOutAtMs: number;
  private readonly fadeOutMs: number;
  private readonly gapMs: number;

  constructor(config: GameMusicConfig) {
    this.volume = clamp(config.volume, 0, 1);
    this.tracks = config.tracks;
    this.fadeInMs = config.fadeInMs;
    this.fadeOutAtMs = config.fadeOutAtMs;
    this.fadeOutMs = config.fadeOutMs;
    this.gapMs = config.gapMs;
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
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private schedule(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private playCurrentTrack(): void {
    if (!this.isActive || this.tracks.length === 0) return;

    const src = this.tracks[this.currentTrackIndex];

    const howl = new Howl({
      src: [src],
      volume: 0, // fade in from silence
      html5: true,
      onplay: () => {
        if (!this.isActive) {
          howl.stop();
          howl.unload();
          return;
        }

        // Fade in.
        howl.fade(0, this.volume, this.fadeInMs);

        // Fade out well before the hard cut-off at the end of the file.
        this.schedule(this.fadeOutAtMs, () => {
          if (!this.isActive || this.currentHowl !== howl) return;
          howl.fade(howl.volume() as number, 0, this.fadeOutMs);

          // Once the fade-out is done, stop the howl, pause, then move to the
          // next track. We stop it explicitly so the abrupt file ending is
          // never heard.
          this.schedule(this.fadeOutMs, () => {
            howl.stop();
            howl.unload();
            if (this.currentHowl === howl) this.currentHowl = null;

            this.schedule(this.gapMs, () => {
              if (!this.isActive) return;
              this.currentTrackIndex =
                (this.currentTrackIndex + 1) % this.tracks.length;
              this.playCurrentTrack();
            });
          });
        });
      },
    });

    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
    }
    this.currentHowl = howl;
    howl.play();
  }
}
