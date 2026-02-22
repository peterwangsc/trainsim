import './style.css';
import { Game } from './game/Game';
import { MobileSplash } from './ui/MobileSplash';

const app = document.getElementById('app');

if (!app) {
  throw new Error('Missing #app root element');
}

let game: Game | null = null;

const startGame = (): void => {
  game?.stop();
  game = new Game(app, {
    onRestartRequested: startGame,
  });
  game.start();
};

const isTouchDevice = navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  new MobileSplash(app, startGame);
} else {
  startGame();
}
