import { clamp } from '../util/Math';

export type RandomAmbientAudioConfig = {
  tracks: readonly string[];
  volume: number;
};

export class RandomAmbientAudio {
  private readonly audio: HTMLAudioElement;
  private readonly onUserGesture = (): void => {
    this.playBlocked = false;
    this.tryStartRandomTrack();
  };
  private readonly onTrackEnded = (): void => {
    this.tryStartRandomTrack();
  };

  private isActive = false;
  private playBlocked = false;
  private currentTrackIndex = -1;

  constructor(private readonly config: RandomAmbientAudioConfig) {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.loop = false;
    this.audio.volume = clamp(config.volume, 0, 1);
    this.audio.addEventListener('ended', this.onTrackEnded);

    window.addEventListener('pointerdown', this.onUserGesture);
    window.addEventListener('keydown', this.onUserGesture);
    window.addEventListener('touchstart', this.onUserGesture, { passive: true });
  }

  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.tryStartRandomTrack();
  }

  stop(): void {
    this.isActive = false;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  dispose(): void {
    this.stop();
    this.audio.removeEventListener('ended', this.onTrackEnded);
    window.removeEventListener('pointerdown', this.onUserGesture);
    window.removeEventListener('keydown', this.onUserGesture);
    window.removeEventListener('touchstart', this.onUserGesture);
    this.audio.src = '';
    this.audio.load();
  }

  private tryStartRandomTrack(): void {
    if (!this.isActive || this.playBlocked || this.config.tracks.length === 0) {
      return;
    }

    const nextTrackIndex = this.pickNextTrackIndex();
    const nextTrackSrc = this.config.tracks[nextTrackIndex];
    this.currentTrackIndex = nextTrackIndex;
    this.audio.src = nextTrackSrc;
    this.audio.currentTime = 0;

    this.audio
      .play()
      .then(() => {
        this.playBlocked = false;
      })
      .catch(() => {
        this.playBlocked = true;
      });
  }

  private pickNextTrackIndex(): number {
    const trackCount = this.config.tracks.length;

    if (trackCount <= 1) {
      return 0;
    }

    let randomIndex = Math.floor(Math.random() * trackCount);

    if (randomIndex === this.currentTrackIndex) {
      randomIndex = (randomIndex + 1) % trackCount;
    }

    return randomIndex;
  }
}
