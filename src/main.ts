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

async function performLogin(
  supabase: any,
  inputUsername: string,
  targetLevel: number,
  userId: string,
  currentUsername: string | null,
): Promise<number> {
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
      return newLevel;
    }

    await supabase.from("user_progress").upsert({
      id: userId,
      level: targetLevel,
      username: inputUsername,
    });
    localStorage.setItem("trainsim_username", inputUsername);
    return targetLevel;
  } catch (err) {
    console.error("Failed to login", err);
    return 0;
  }
}

async function runBootSequence(): Promise<void> {
  const loadingModulePromise = import("./loading/CriticalAssetPreloader");
  const gameModulePromise = import("./game/Game");
  let splash: LoadingSplash | null = null;

  const { preloadCriticalAssets, warmupAudioContext } =
    await loadingModulePromise;
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

    function startGameAtLevel(
      level: number,
      activeUserId: string,
      activeUsername: string | null,
    ): void {
      if (game) {
        game.stop();
      }

      game = new gameModule.Game(app!, {
        level,
        username: activeUsername,
        preloadedAssets,
        onRestartRequested: () => game?.restart(),
        onNextLevelRequested: async () => {
          const nextLevel = level + 1;
          try {
            const payload: any = { id: activeUserId, level: nextLevel };
            if (activeUsername) {
              payload.username = activeUsername;
            }
            await supabase.from("user_progress").upsert(payload);
          } catch (err) {
            console.error("Failed to save progress", err);
          }
          startGameAtLevel(nextLevel, activeUserId, activeUsername);
          game?.start();
        },
        onLogin: async (inputUsername: string, targetLevel: number) => {
          try {
            const payload: any = { id: activeUserId, level: targetLevel };
            await supabase.from("user_progress").upsert(payload);
          } catch (err) {
            console.error("Failed to save progress", err);
          }

          const newLevel = await performLogin(
            supabase,
            inputUsername,
            targetLevel,
            activeUserId,
            activeUsername,
          );
          const newUserId = localStorage.getItem("trainsim_uuid")!;

          if (newLevel) {
            startGameAtLevel(newLevel, newUserId, inputUsername);
            game?.start();
          }
        },
        onLogout: async () => {
          const oldUuid = localStorage.getItem("trainsim_userless_uuid");
          let nextUserId = "";
          let nextLevel = 1;

          if (oldUuid) {
            localStorage.setItem("trainsim_uuid", oldUuid);
            localStorage.removeItem("trainsim_userless_uuid");
            nextUserId = oldUuid;
            try {
              const { data } = await supabase
                .from("user_progress")
                .select("level")
                .eq("id", oldUuid)
                .maybeSingle();
              if (data) {
                nextLevel = data.level;
              } else {
                await supabase
                  .from("user_progress")
                  .upsert({ id: oldUuid, level: 1 });
              }
            } catch (err) {
              console.error("Failed to update userless progress", err);
            }
          } else {
            nextUserId = crypto.randomUUID();
            localStorage.setItem("trainsim_uuid", nextUserId);
            try {
              await supabase
                .from("user_progress")
                .upsert({ id: nextUserId, level: 1 });
            } catch (err) {
              console.error("Failed to init new userless progress", err);
            }
          }

          localStorage.removeItem("trainsim_username");
          startGameAtLevel(nextLevel, nextUserId, null);
          game?.start();
        },
      });
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
        const payload: any = { id: userId, level: 1 };
        if (currentUsername) {
          payload.username = currentUsername;
        }
        await supabase.from("user_progress").upsert(payload);
      }
    } catch (err) {
      console.error("Failed to fetch user progress", err);
    }

    if (isNaN(savedLevel) || savedLevel < 1) {
      savedLevel = 1;
    }

    startGameAtLevel(savedLevel, userId, currentUsername);

    splash = new LoadingSplash(
      app!,
      async (enteredUsername) => {
        if (enteredUsername && !currentUsername) {
          const success = await performLogin(
            supabase,
            enteredUsername,
            savedLevel,
            userId,
            currentUsername,
          );
          if (success) {
            const newUserId = localStorage.getItem("trainsim_uuid")!;
            const newUsername = localStorage.getItem("trainsim_username");
            let nextLevel = savedLevel;
            try {
              const { data } = await supabase
                .from("user_progress")
                .select("level")
                .eq("id", newUserId)
                .maybeSingle();
              if (data) {
                nextLevel = data.level;
              }
            } catch (err) {
              console.error("Failed to fetch level after splash login", err);
            }
            startGameAtLevel(nextLevel, newUserId, newUsername);
          }
        }
        await warmupAudioContext();
        game?.start();
      },
      currentUsername,
    );

    splash.setReady();
  } catch (error) {
    console.error("Boot sequence failed:", error);
  }
}

void runBootSequence();
