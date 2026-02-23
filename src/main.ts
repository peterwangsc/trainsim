import { createClient } from "@supabase/supabase-js";
import "./style.css";
import type { Game } from "./game/Game";
import type { CriticalPreloadedAssets } from "./loading/CriticalAssetPreloader";
import { LoadingSplash } from "./ui/LoadingSplash";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string);

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

    const startGameAtLevel = (level: number, userId: string) => {
      if (game) {
        game.stop();
      }
      game = new gameModule.Game(app, {
        level,
        onRestartRequested: () => {
          game?.restart();
        },
        onNextLevelRequested: async () => {
          const nextLevel = level + 1;
          try {
            await supabase
              .from("user_progress")
              .upsert({ id: userId, level: nextLevel });
          } catch (err) {
            console.error("Failed to save progress", err);
          }
          startGameAtLevel(nextLevel, userId);
          game?.start();
        },
        preloadedAssets,
      });
    };

    let userId = localStorage.getItem("trainsim_uuid");
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("trainsim_uuid", userId);
    }

    let savedLevel = 1;
    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select("level")
        .eq("id", userId)
        .maybeSingle();
      
      if (error) {
        console.error("Failed to fetch user progress", error);
      } else if (data) {
        savedLevel = data.level;
      } else {
        // No row found, upsert a new one for this user with default level 1
        const { error: upsertError } = await supabase
          .from("user_progress")
          .upsert({ id: userId, level: 1 });
        if (upsertError) {
           console.error("Failed to init user progress", upsertError);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user progress", err);
    }

    if (isNaN(savedLevel) || savedLevel < 1) {
      savedLevel = 1;
    }
    startGameAtLevel(savedLevel, userId);

    splash.setReady();
  } catch (error) {
    console.error(error);
    splash.setError("Load failed. Refresh to retry.");
  }
};

void runBootSequence();
