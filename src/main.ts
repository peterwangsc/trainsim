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
  let splash: LoadingSplash | null = null;

  const { preloadCriticalAssets } = await loadingModulePromise;
  preloadedAssetsPromise = preloadCriticalAssets((progress) => {
    splash?.setProgress(progress);
  });

  try {
    const [preloadedAssets, gameModule] = await Promise.all([
      preloadedAssetsPromise,
      gameModulePromise,
    ]);

    let userId = localStorage.getItem("trainsim_uuid");
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("trainsim_uuid", userId);
    }
    const currentUsername = localStorage.getItem("trainsim_username") || null;

    const performLogin = async (inputUsername: string, targetLevel: number) => {
      try {
        const { data, error } = await supabase
          .from("user_progress")
          .select("id, level")
          .eq("username", inputUsername)
          .maybeSingle();

        if (data && !error) {
          if (!currentUsername) {
            localStorage.setItem("trainsim_userless_uuid", userId);
          }
          const newLevel = Math.max(targetLevel, data.level);
          if (newLevel > data.level) {
            await supabase
              .from("user_progress")
              .update({ level: newLevel })
              .eq("id", data.id);
          }
          localStorage.setItem("trainsim_uuid", data.id);
          localStorage.setItem("trainsim_username", inputUsername);
          return true;
        } else {
          await supabase
            .from("user_progress")
            .upsert({ id: userId, level: targetLevel, username: inputUsername });
          localStorage.setItem("trainsim_username", inputUsername);
          return true;
        }
      } catch (err) {
        console.error("Failed to login", err);
        return false;
      }
    };

    const startGameAtLevel = (level: number, userId: string, username: string | null) => {
      if (game) {
        game.stop();
      }
      game = new gameModule.Game(app, {
        level,
        username,
        onRestartRequested: () => {
          game?.restart();
        },
        onNextLevelRequested: async () => {
          const nextLevel = level + 1;
          try {
            const payload: any = { id: userId, level: nextLevel };
            if (username) {
              payload.username = username;
            }
            await supabase
              .from("user_progress")
              .upsert(payload);
          } catch (err) {
            console.error("Failed to save progress", err);
          }
          startGameAtLevel(nextLevel, userId, username);
          game?.start();
        },
        onLogin: async (inputUsername: string, targetLevel: number) => {
          const success = await performLogin(inputUsername, targetLevel);
          if (success) {
            const newUserId = localStorage.getItem("trainsim_uuid")!;
            const newUsername = localStorage.getItem("trainsim_username");
            let nextLevel = targetLevel;
            try {
              const { data } = await supabase
                .from("user_progress")
                .select("level")
                .eq("id", newUserId)
                .maybeSingle();
              if (data) nextLevel = data.level;
            } catch (err) {
              console.error("Failed to fetch next level on login", err);
            }
            startGameAtLevel(nextLevel, newUserId, newUsername);
            game?.start();
          }
        },
        onLogout: async () => {
          const oldUuid = localStorage.getItem("trainsim_userless_uuid");
          let newUserId = "";
          let nextLevel = 1;
          if (oldUuid) {
            localStorage.setItem("trainsim_uuid", oldUuid);
            localStorage.removeItem("trainsim_userless_uuid");
            newUserId = oldUuid;
            try {
              const { data } = await supabase
                .from("user_progress")
                .select("level")
                .eq("id", oldUuid)
                .maybeSingle();
              if (data) {
                nextLevel = data.level + 1;
                await supabase
                  .from("user_progress")
                  .update({ level: nextLevel })
                  .eq("id", oldUuid);
              } else {
                await supabase
                  .from("user_progress")
                  .upsert({ id: oldUuid, level: 1 });
              }
            } catch (err) {
              console.error("Failed to update userless progress", err);
            }
          } else {
            newUserId = crypto.randomUUID();
            localStorage.setItem("trainsim_uuid", newUserId);
            try {
              await supabase
                .from("user_progress")
                .upsert({ id: newUserId, level: 1 });
            } catch (err) {
              console.error("Failed to init new userless progress", err);
            }
          }
          localStorage.removeItem("trainsim_username");
          startGameAtLevel(nextLevel, newUserId, null);
          game?.start();
        },
        preloadedAssets,
      });
    };

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
        const payload: any = { id: userId, level: 1 };
        if (currentUsername) {
           payload.username = currentUsername;
        }
        const { error: upsertError } = await supabase
          .from("user_progress")
          .upsert(payload);
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
    startGameAtLevel(savedLevel, userId, currentUsername);

    splash = new LoadingSplash(app, async (enteredUsername) => {
      if (enteredUsername && !currentUsername) {
        const success = await performLogin(enteredUsername, savedLevel);
        if (success) {
          window.location.reload();
          return;
        }
      }
      const { warmupAudioContext } = await loadingModulePromise;
      await warmupAudioContext();
      game?.start();
    }, currentUsername);

    splash.setReady();
  } catch (error) {
    console.error(error);
  }
};

void runBootSequence();
