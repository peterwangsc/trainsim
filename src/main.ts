import "@/style.css";
import { initSupabase } from "@/util/Supabase";
import { CONFIG } from "@/game/Config";
import { inject } from "@vercel/analytics";

inject();

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app root element");

const { pathname } = window.location;

if (pathname === "/zoo") {
  const { ZooPage } = await import("@/zoo/ZooPage");
  const zoo = new ZooPage(app);
  void zoo.init();
} else if (pathname === "/policy") {
  const { PolicyPage } = await import("@/legal/PolicyPage");
  new PolicyPage(app);
} else if (pathname === "/terms") {
  const { TermsPage } = await import("@/legal/TermsPage");
  new TermsPage(app);
} else {
  const { Game } = await import("@/game/Game");
  initSupabase();
  const game = new Game(app, CONFIG);
  void game.preload();
}
