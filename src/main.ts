import "./style.css";
import type { Game } from "./game/Game";
import type { CriticalPreloadedAssets } from "./loading/CriticalAssetPreloader";
import { LoadingSplash } from "./ui/LoadingSplash";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Missing #app root element");
}

let game: Game | null = null;
let preloadedAssetsPromise: Promise<CriticalPreloadedAssets>;

const runBootSequence = async (): Promise<void> => {
  const loadingModulePromise = import("./loading/CriticalAssetPreloader");
  const gameModulePromise = import("./game/Game");

  const splash = new LoadingSplash(app, async () => {
    const { warmupAudioContext } = await loadingModulePromise;
    await warmupAudioContext();
    game?.start();
  });

  const { preloadCriticalAssets } = await loadingModulePromise;
  preloadedAssetsPromise = preloadCriticalAssets((progress) => {
    splash.setProgress(progress);
  });

  try {
    const [preloadedAssets, gameModule] = await Promise.all([
      preloadedAssetsPromise,
      gameModulePromise,
    ]);
    game = new gameModule.Game(app, {
      onRestartRequested: () => {
        game?.restart();
      },
      preloadedAssets,
    });
    splash.setReady();
  } catch (error) {
    console.error(error);
    splash.setError("Load failed. Refresh to retry.");
  }
};

void runBootSequence();
