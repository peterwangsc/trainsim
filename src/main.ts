import "./style.css";
import { initSupabase } from "./util/Supabase";
import { CONFIG } from "./game/Config";
import { inject } from "@vercel/analytics";

inject();

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app root element");

if (window.location.pathname === "/zoo") {
  const { ZooPage } = await import("./zoo/ZooPage");
  const zoo = new ZooPage(app);
  void zoo.init();
} else {
  const { Game } = await import("./game/Game");
  initSupabase();
  const game = new Game(app, CONFIG);
  void game.preload();
}
