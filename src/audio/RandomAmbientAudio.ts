import { Howl } from 'howler';
import { clamp } from '../util/Math';

export type RandomAmbientAudioConfig = {
  tracks: readonly string[];
  volume: number;
};

export class RandomAmbientAudio {
  private currentHowl: Howl | null = null;
  private isActive = false;
  private currentTrackIndex = -1;
  private readonly volume: number;
  private readonly tracks: readonly string[];

  constructor(config: RandomAmbientAudioConfig) {
    this.volume = clamp(config.volume, 0, 1);
    this.tracks = config.tracks;
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.playNextTrack();
  }

  stop(): void {
    this.isActive = false;
    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private playNextTrack(): void {
    if (!this.isActive || this.tracks.length === 0) return;

    const nextIndex = this.pickNextTrackIndex();
    this.currentTrackIndex = nextIndex;

    if (this.currentHowl) {
      this.currentHowl.unload();
    }

    this.currentHowl = new Howl({
      src: [this.tracks[nextIndex]],
      volume: this.volume,
      html5: false, // Web Audio API — required for volume control on iOS (HTMLAudioElement.volume is read-only there)
      onend: () => {
        this.playNextTrack();
      },
    });

    this.currentHowl.play();
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
