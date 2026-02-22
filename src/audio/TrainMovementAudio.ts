import { clamp } from '../util/Math';

type PitchPreservingAudio = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

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
  private readonly audio: PitchPreservingAudio;
  private readonly onUserGesture = (): void => {
    this.playBlocked = false;
    this.tryStart();
  };

  private wantsToPlay = false;
  private playBlocked = false;

  constructor(private readonly config: TrainMovementAudioConfig) {
    const audio = new Audio(config.src) as PitchPreservingAudio;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;
    this.audio = audio;

    window.addEventListener('pointerdown', this.onUserGesture);
    window.addEventListener('keydown', this.onUserGesture);
    window.addEventListener('touchstart', this.onUserGesture, { passive: true });
  }

  update(speed: number, dt: number): void {
    this.wantsToPlay = speed > this.config.movementThreshold;

    if (!this.wantsToPlay) {
      const releaseFadeSeconds = this.config.releaseFadeSeconds ?? 0;

      if (releaseFadeSeconds > 0 && !this.audio.paused) {
        const fadePerSecond = 1 / releaseFadeSeconds;
        this.audio.volume = clamp(this.audio.volume - fadePerSecond * dt, 0, 1);

        if (this.audio.volume <= 0.001) {
          this.audio.volume = 0;
          this.audio.pause();
        }
      } else {
        if (!this.audio.paused) {
          this.audio.pause();
        }
        this.audio.volume = 0;
      }
      return;
    }

    const speedRatio = clamp(speed / this.config.maxTrainSpeed, 0, 1);
    this.audio.playbackRate =
      this.config.minPlaybackRate +
      (this.config.maxPlaybackRate - this.config.minPlaybackRate) * speedRatio;
    this.audio.volume = clamp(
      this.config.minVolume +
        (this.config.maxVolume - this.config.minVolume) * speedRatio,
      0,
      1
    );
    this.tryStart();
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onUserGesture);
    window.removeEventListener('keydown', this.onUserGesture);
    window.removeEventListener('touchstart', this.onUserGesture);
    this.audio.pause();
    this.audio.src = '';
    this.audio.load();
  }

  private tryStart(): void {
    if (!this.wantsToPlay || this.playBlocked || !this.audio.paused) {
      return;
    }

    this.audio
      .play()
      .then(() => {
        this.playBlocked = false;
      })
      .catch(() => {
        this.playBlocked = true;
      });
  }
}
