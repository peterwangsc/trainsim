import { Scene, Texture } from "three";
import { DayNightSky } from './DayNightSky';

export type SceneSetup = {
  scene: Scene;
  dayNightSky: DayNightSky;
};

export type SceneSetupOptions = {
  cloudTexture: Texture;
};

export function createScene(options: SceneSetupOptions): SceneSetup {
  const scene = new Scene();
  const dayNightSky = new DayNightSky(scene, {
    cloudTexture: options.cloudTexture,
  });

  return {
    scene,
    dayNightSky,
  };
}
