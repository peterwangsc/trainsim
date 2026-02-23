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

    const startGameAtLevel = (level: number) => {
      if (game) {
        game.stop();
      }
      game = new gameModule.Game(app, {
        level,
        onRestartRequested: () => {
          game?.restart();
        },
        onNextLevelRequested: () => {
          const nextLevel = level + 1;
          localStorage.setItem("trainsim_level", nextLevel.toString());
          startGameAtLevel(nextLevel);
          game?.start();
        },
        preloadedAssets,
      });
    };

    let savedLevel = parseInt(localStorage.getItem("trainsim_level") ?? "1", 10);
    if (isNaN(savedLevel) || savedLevel < 1) {
      savedLevel = 1;
    }
    startGameAtLevel(savedLevel);

    splash.setReady();
  } catch (error) {
    console.error(error);
    splash.setError("Load failed. Refresh to retry.");
  }
};

void runBootSequence();
