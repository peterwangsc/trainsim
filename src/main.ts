import "./style.css";
import { Game } from "./game/Game";
import { initSupabase } from "./util/Supabase";
import { CONFIG } from "./game/Config";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app root element");

initSupabase();

const game = new Game(app, CONFIG);
void game.preload();
