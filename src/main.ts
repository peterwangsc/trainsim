import './style.css';
import { Game } from './game/Game';

const app = document.getElementById('app');

if (!app) {
  throw new Error('Missing #app root element');
}

const game = new Game(app);
game.start();
