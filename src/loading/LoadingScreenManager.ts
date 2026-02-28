import { GameState } from "../game/GameState";
import {
  CriticalPreloadedAssets,
  preloadCriticalAssets,
} from "../loading/CriticalAssetPreloader";
import { LoadingSplash } from "../ui/LoadingSplash";
import { fetchUserPresetContents, login } from "../util/Username";

export class LoadingScreenManager {
  private container: HTMLElement;
  private gameState: GameState;
  private onStart: () => void;
  private loadingSplash: LoadingSplash | null = null;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    onStart: () => void,
  ) {
    this.gameState = gameState;
    this.container = container;
    this.onStart = onStart;
  }

  public async preload(): Promise<{ assets: CriticalPreloadedAssets }> {
    this.loadingSplash = new LoadingSplash(
      this.container,
      this.gameState,
      async (enteredUsername) => {
        if (enteredUsername) {
          await login(enteredUsername, this.gameState);
        }
        this.onStart();
      },
    );

    const [assets, presetContents] = await Promise.all([
      preloadCriticalAssets((progress) =>
        this.loadingSplash?.setProgress(progress),
      ),
      fetchUserPresetContents(this.gameState.userId, this.gameState.username),
    ]);
    this.gameState.update({ 
      level: presetContents.level,
      masterVolume: presetContents.masterVolume ?? 0.5,
      musicVolume: presetContents.musicVolume ?? 0.5,
      sfxVolume: presetContents.sfxVolume ?? 0.5,
    });
    // Let the splash screen know the initial sound settings for the sliders
    this.loadingSplash.setSoundSettings(
      this.gameState.masterVolume,
      this.gameState.musicVolume,
      this.gameState.sfxVolume
    );
    this.loadingSplash.setReady();
    return { assets };
  }

  public dispose(): void {
    this.loadingSplash?.dispose();
  }
}
