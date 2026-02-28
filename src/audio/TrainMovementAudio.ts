import { Howl } from "howler";
import { clamp } from "../util/Math";

export type TrainMovementAudioConfig = {
  srcs: string[];
  preloadedHowls: Howl[];
  maxTrainSpeed: number;
  movementThreshold: number;
  minVolume: number;
  maxVolume: number;
  releaseFadeSeconds?: number;
};

type LayerPhase = "fade_in" | "playing" | "fade_out" | "done";

type Layer = {
  trackIdx: number;
  howl: Howl;
  soundId: number | null;
  targetLoops: number;
  loopsDone: number;
  phase: LayerPhase;
  phaseProgress: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class TrainMovementAudio {
  private readonly howls: Howl[] = [];
  private readonly config: TrainMovementAudioConfig;
  private layers: Layer[] = [];
  private accumulatedTime = 0;
  private nextSpawnAt = 0;
  private baseVolume = 0;
  private singleSoundId: number | null = null;
  private singleIsPaused = false;
  private singleCurrentVolume = 0;
  private volumeScale: number = 1.0;

  constructor(config: TrainMovementAudioConfig) {
    this.config = config;
    if (config.preloadedHowls.length !== config.srcs.length) {
      throw new Error("TrainMovementAudio requires fully preloaded howls.");
    }
    const expectedLooping = config.srcs.length === 1;
    for (let index = 0; index < config.preloadedHowls.length; index += 1) {
      const howl = config.preloadedHowls[index];
      howl.stop();
      howl.off();
      howl.loop(expectedLooping);
      this.howls.push(howl);
    }
  }

  setVolumeScale(scale: number): void {
    this.volumeScale = scale;
    // singleCurrentVolume or baseVolume will just update naturally in the next update() tick.
  }

  private getActiveCount(): number {
    return this.layers.filter((l) => l.phase !== "done").length;
  }

  private getPlayingTrackIndices(): Set<number> {
    return new Set(
      this.layers.filter((l) => l.phase !== "done").map((l) => l.trackIdx)
    );
  }

  private spawnLayer(): void {
    const playing = this.getPlayingTrackIndices();
    if (playing.size >= 3) return;

    const available = this.config.srcs
      .map((_, i) => i)
      .filter((i) => !playing.has(i));
    if (available.length === 0) return;

    const trackIdx = available[Math.floor(Math.random() * available.length)];
    const howl = this.howls[trackIdx];
    const targetLoops = randomInt(2, 6);
    const fadeInSeconds = randomFloat(0.25, 0.5);
    const fadeOutSeconds = randomFloat(0.25, 0.5);

    const soundId = howl.play();
    if (soundId === undefined) return;
    howl.volume(this.baseVolume > 0 ? this.baseVolume / (this.getActiveCount() + 1) : 0, soundId);

    const layer: Layer = {
      trackIdx,
      howl,
      soundId,
      targetLoops,
      loopsDone: 0,
      phase: "fade_in",
      phaseProgress: 0,
      fadeInSeconds,
      fadeOutSeconds,
    };
    this.layers.push(layer);

    const onEnd = (): void => {
      const l = this.layers.find((x) => x === layer);
      if (!l) return;
      l.loopsDone++;
              if (l.loopsDone < l.targetLoops) {
                const nextId = howl.play();
                if (nextId !== undefined) {
                  l.soundId = nextId;
                  const vol = this.getLayerVolume(l);
                  howl.volume(vol, nextId);
                  howl.once("end", onEnd);        }
      } else {
        l.phase = "fade_out";
        l.phaseProgress = 0;
      }
    };
    howl.once("end", onEnd);
  }


  private getLayerVolume(layer: Layer): number {
    const activeCount = this.getActiveCount();
    if (activeCount <= 0) return 0;
    const share = this.baseVolume / activeCount;
    if (layer.phase === "fade_in") {
      const t = Math.min(1, layer.phaseProgress / layer.fadeInSeconds);
      return share * t;
    }
    if (layer.phase === "fade_out") {
      const t = Math.min(1, layer.phaseProgress / layer.fadeOutSeconds);
      return share * (1 - t);
    }
    return share;
  }

  update(speed: number, dt: number): void {
    const wantsToPlay = speed > this.config.movementThreshold;

    if (this.config.srcs.length === 1) {
      const howl = this.howls[0];
      if (!wantsToPlay) {
        const releaseFadeSeconds = this.config.releaseFadeSeconds ?? 0;
        if (this.singleSoundId !== null && !this.singleIsPaused) {
          if (releaseFadeSeconds > 0 && howl.playing(this.singleSoundId)) {
            this.singleCurrentVolume = clamp(
              this.singleCurrentVolume - dt / releaseFadeSeconds,
              0,
              0.5
            );
            howl.volume(this.singleCurrentVolume, this.singleSoundId);
            if (this.singleCurrentVolume <= 0.001) {
              howl.pause(this.singleSoundId);
              this.singleIsPaused = true;
              this.singleCurrentVolume = 0;
            }
          } else if (howl.playing(this.singleSoundId)) {
            howl.pause(this.singleSoundId);
            this.singleIsPaused = true;
            this.singleCurrentVolume = 0;
          }
        }
        return;
      }
      const speedRatio = clamp(speed / this.config.maxTrainSpeed, 0, 1);
      this.singleCurrentVolume = clamp(
        (this.config.minVolume +
          (this.config.maxVolume - this.config.minVolume) * speedRatio) * this.volumeScale,
        0,
        1
      );
      if (this.singleSoundId === null) {
        this.singleSoundId = howl.play();
        this.singleIsPaused = false;
      } else if (this.singleIsPaused) {
        howl.play(this.singleSoundId);
        this.singleIsPaused = false;
      }
      howl.volume(this.singleCurrentVolume, this.singleSoundId);
      return;
    }

    if (!wantsToPlay) {
      const releaseFadeSeconds = this.config.releaseFadeSeconds ?? 0;
      if (releaseFadeSeconds > 0) {
        this.baseVolume = Math.max(
          0,
          this.baseVolume - dt / releaseFadeSeconds
        );
      } else {
        this.baseVolume = 0;
      }

      for (const layer of this.layers) {
        if (layer.phase !== "done" && layer.soundId !== null) {
          const vol = this.getLayerVolume(layer);
          layer.howl.volume(vol, layer.soundId);
          if (this.baseVolume <= 0.001) {
            layer.howl.stop(layer.soundId);
            layer.soundId = null;
            layer.phase = "done";
          }
        }
      }

      if (this.baseVolume <= 0.001) {
        this.layers = this.layers.filter((l) => l.phase !== "done");
      }
      return;
    }

    const speedRatio = clamp(speed / this.config.maxTrainSpeed, 0, 1);
    this.baseVolume = clamp(
      (this.config.minVolume +
        (this.config.maxVolume - this.config.minVolume) * speedRatio) * this.volumeScale,
      0,
      1
    );

    this.accumulatedTime += dt;

    for (const layer of this.layers) {
      if (layer.phase === "done") continue;

      if (layer.phase === "fade_in") {
        layer.phaseProgress += dt;
        if (layer.phaseProgress >= layer.fadeInSeconds) {
          layer.phase = "playing";
        }
      } else if (layer.phase === "fade_out") {
        layer.phaseProgress += dt;
        const vol = this.getLayerVolume(layer);
        if (layer.soundId !== null) {
          layer.howl.volume(vol, layer.soundId);
        }
        if (layer.phaseProgress >= layer.fadeOutSeconds) {
          if (layer.soundId !== null) {
            layer.howl.stop(layer.soundId);
          }
          layer.soundId = null;
          layer.phase = "done";
        }
        continue;
      }

      if (layer.soundId !== null) {
        const vol = this.getLayerVolume(layer);
        layer.howl.volume(vol, layer.soundId);
      }
    }

    this.layers = this.layers.filter((l) => l.phase !== "done");

    const activeCount = this.getActiveCount();
    if (activeCount < 2) {
      this.spawnLayer();
      if (this.getActiveCount() < 2) this.spawnLayer();
    } else if (this.accumulatedTime >= this.nextSpawnAt) {
      if (activeCount < 3 && Math.random() < 0.15) {
        this.spawnLayer();
      }
      this.nextSpawnAt = this.accumulatedTime + randomFloat(0.5, 2);
    }
  }

  dispose(): void {
    if (this.config.srcs.length === 1 && this.singleSoundId !== null) {
      this.howls[0].stop(this.singleSoundId);
      this.singleSoundId = null;
    }
    for (const layer of this.layers) {
      if (layer.soundId !== null) {
        layer.howl.stop(layer.soundId);
      }
    }
    this.layers = [];
    for (const howl of this.howls) {
      howl.off();
      howl.stop();
    }
  }
}
