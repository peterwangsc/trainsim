import { Scene } from 'three';
import { DayNightSky } from './DayNightSky';

export type SceneSetup = {
  scene: Scene;
  dayNightSky: DayNightSky;
};

export const createScene = (): SceneSetup => {
  const scene = new Scene();
  const dayNightSky = new DayNightSky(scene);

  return {
    scene,
    dayNightSky
  };
};
