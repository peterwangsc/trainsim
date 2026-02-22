import { Howl } from 'howler';
import { clamp } from '../util/Math';

export type TrainMovementAudioConfig = {
  src: string;
  maxTrainSpeed: number;
  movementThreshold: number;
  minPlaybackRate: number;
  maxPlaybackRate: number;
  minVolume: number;
  maxVolume: number;
  releaseFadeSeconds?: number;
};

export class TrainMovementAudio {
  private readonly howl: Howl;
  private soundId: number | null = null;
  private isPaused = false;
  private currentVolume = 0;

  constructor(private readonly config: TrainMovementAudioConfig) {
    this.howl = new Howl({
      src: [config.src],
      loop: true,
      volume: 0,
      html5: false, // Use Web Audio API — critical for real-time rate/volume changes on mobile Safari
      preload: true,
    });
  }

  update(speed: number, dt: number): void {
    const wantsToPlay = speed > this.config.movementThreshold;

    if (!wantsToPlay) {
      if (this.soundId !== null && !this.isPaused) {
        const releaseFadeSeconds = this.config.releaseFadeSeconds ?? 0;

        if (releaseFadeSeconds > 0 && this.howl.playing(this.soundId)) {
          this.currentVolume = clamp(this.currentVolume - dt / releaseFadeSeconds, 0, 1);
          this.howl.volume(this.currentVolume, this.soundId);

          if (this.currentVolume <= 0.001) {
            this.howl.pause(this.soundId);
            this.isPaused = true;
            this.currentVolume = 0;
          }
        } else if (this.howl.playing(this.soundId)) {
          this.howl.pause(this.soundId);
          this.isPaused = true;
          this.currentVolume = 0;
        }
      }
      return;
    }

    const speedRatio = clamp(speed / this.config.maxTrainSpeed, 0, 1);
    const targetRate =
      this.config.minPlaybackRate +
      (this.config.maxPlaybackRate - this.config.minPlaybackRate) * speedRatio;
    this.currentVolume = clamp(
      this.config.minVolume + (this.config.maxVolume - this.config.minVolume) * speedRatio,
      0,
      1,
    );

    if (this.soundId === null) {
      this.soundId = this.howl.play();
      this.isPaused = false;
    } else if (this.isPaused) {
      this.howl.play(this.soundId);
      this.isPaused = false;
    }

    this.howl.rate(targetRate, this.soundId);
    this.howl.volume(this.currentVolume, this.soundId);
  }

  dispose(): void {
    this.howl.unload();
  }
}
