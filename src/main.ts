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

  let userId = localStorage.getItem("trainsim_uuid");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("trainsim_uuid", userId);
  }
  const currentUsername = localStorage.getItem("trainsim_username") || null;

  const { preloadCriticalAssets, warmupAudioContext } =
    await loadingModulePromise;

  // Create splash before preloading starts
  const splashPromise = new Promise<void>((resolve) => {
    splash = new LoadingSplash(
      app!,
      async (enteredUsername) => {
        await warmupAudioContext();
        const { preloadedAssets, gameModule } = await bootResults;
        const finalUserId = localStorage.getItem("trainsim_uuid")!;
        const finalUsername = localStorage.getItem("trainsim_username") || currentUsername;
        
        // Use the savedLevel from the outer scope once it's fetched
        const levelToStart = await savedLevelPromise;

        if (enteredUsername && !currentUsername) {
          const success = await performLogin(
            supabase,
            enteredUsername,
            levelToStart,
            finalUserId,
            currentUsername,
          );
          if (success) {
            const newUserId = localStorage.getItem("trainsim_uuid")!;
            const newUsername = localStorage.getItem("trainsim_username");
            let nextLevel = levelToStart;
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
            
            if (game) game.stop();
            game = new gameModule.Game(app!, {
              level: nextLevel,
              username: newUsername,
              preloadedAssets,
              onRestartRequested: () => game?.restart(),
              onNextLevelRequested: async () => {
                const nextLevelVal = nextLevel + 1;
                try {
                  await supabase.from("user_progress").upsert({ id: newUserId, level: nextLevelVal, username: newUsername });
                } catch (err) { console.error(err); }
                // This is a bit simplified, but follows the logic
                window.location.reload(); 
              },
              onLogin: async () => {}, // Handled by splash
              onLogout: () => window.location.reload(),
            });
          }
        }
        game?.start();
      },
      currentUsername,
    );
    resolve();
  });

  await splashPromise;

  preloadedAssetsPromise = preloadCriticalAssets((progress) => {
    splash?.setProgress(progress);
  });

  const savedLevelPromise = (async () => {
    let level = 1;
    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select("level")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        level = data.level;
      } else if (!data) {
        const payload: any = { id: userId, level: 1 };
        if (currentUsername) payload.username = currentUsername;
        await supabase.from("user_progress").upsert(payload);
      }
    } catch (err) {
      console.error("Failed to fetch user progress", err);
    }
    return level;
  })();

  const bootResults = Promise.all([
    preloadedAssetsPromise,
    gameModulePromise,
  ]).then(([preloadedAssets, gameModule]) => ({ preloadedAssets, gameModule }));

  try {
    const { preloadedAssets, gameModule } = await bootResults;
    const level = await savedLevelPromise;

    function startGameAtLevel(
      l: number,
      activeUserId: string,
      activeUsername: string | null,
    ): void {
      if (game) {
        game.stop();
      }

      game = new gameModule.Game(app!, {
        level: l,
        username: activeUsername,
        preloadedAssets,
        onRestartRequested: () => game?.restart(),
        onNextLevelRequested: async () => {
          const nextLevel = l + 1;
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
      });
    }

    startGameAtLevel(level, userId!, currentUsername);
    splash!.setReady();
  } catch (error) {
    console.error("Boot sequence failed:", error);
  }
}

void runBootSequence();
