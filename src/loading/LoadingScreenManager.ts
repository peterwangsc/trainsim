import { GameState } from "../game/GameState";
import {
  CriticalPreloadedAssets,
  preloadCriticalAssets,
} from "../loading/CriticalAssetPreloader";
import { LoadingSplash } from "../ui/LoadingSplash";
import { fetchSavedLevel, login } from "../util/Username";

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

    const [assets, level] = await Promise.all([
      preloadCriticalAssets((progress) =>
        this.loadingSplash?.setProgress(progress),
      ),
      fetchSavedLevel(this.gameState.userId, this.gameState.username),
    ]);
    this.gameState.update({ level });
    this.loadingSplash.setReady();
    return { assets };
  }

  public dispose(): void {
    this.loadingSplash?.dispose();
  }
}
