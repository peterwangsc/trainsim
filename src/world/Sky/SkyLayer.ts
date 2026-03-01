import {
  AmbientLight,
  Color,
  Fog,
  HemisphereLight,
  MathUtils,
  Material,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import {
  directionalFogFragment,
  directionalFogPars,
} from "@/world/Sky/shaders/dayNightSkyShader";
import type { CONFIG } from "@/game/Config";
import type { CriticalPreloadedAssets } from "@/loading/CriticalAssetPreloader";
import { SkyMesh } from "@/world/Sky/SkyMesh";
import { Starfield } from "@/world/Sky/Starfield";
import { SunLight } from "@/world/Sky/SunLight";
import { Moon } from "@/world/Sky/Moon";
import { CloudLayer, type TerrainHeightSampler } from "@/world/Sky/CloudLayer";

export class SkyLayer {
  public readonly ambientLight: AmbientLight;
  public readonly hemisphereLight: HemisphereLight;

  private readonly skyMesh: SkyMesh;
  private readonly starfield: Starfield;
  private readonly sun: SunLight;
  private readonly moon: Moon;
  private readonly cloudLayer: CloudLayer;

  private readonly daySkyColor = new Color("#7fbbff");
  private readonly nightSkyColor = new Color("#071634");
  private readonly deepNightSkyColor = new Color("#02060f");
  private readonly blendedSkyColor = new Color("#7fbbff");

  private readonly dayHemisphereSkyColor = new Color("#dcefff");
  private readonly twilightHemisphereSkyColor = new Color("#ffa0fe");
  private readonly nightHemisphereSkyColor = new Color("#1a2a4c");
  private readonly dayHemisphereGroundColor = new Color("#7f9468");
  private readonly nightHemisphereGroundColor = new Color("#0f1624");
  private readonly dayAmbientColor = new Color("#cfe0ff");
  private readonly twilightAmbientColor = new Color("#b49ab6");
  private readonly nightAmbientColor = new Color("#1d2f54");

  private readonly cloudDayColor = new Color("#f4f7ff");
  private readonly cloudTwilightColor = new Color("#ffc2ed");
  private readonly cloudNightColor = new Color("#8a9fca");

  private readonly hemisphereSkyColor = new Color();
  private readonly hemisphereGroundColor = new Color();
  private readonly ambientColor = new Color();

  private readonly lightAnchor = new Vector3();
  private readonly sunOffset = new Vector3();
  private readonly sunDirection = new Vector3();
  private readonly moonDirection = new Vector3();

  private readonly directionalFogSunViewDirectionUniform = {
    value: new Vector3(0, 0, -1),
  };
  private readonly directionalFogStrengthUniform = {
    value: 0.2, // will be updated
  };
  private readonly directionalFogPatchedMaterials = new WeakSet<Material>();
  private directionalFogEnabled = false;

  private elapsedSeconds = 0;
  private timeOverrideSeconds: number | null = null;
  private nightFactor = 0;
  private recommendedExposure = 0.8;

  constructor(
    private readonly scene: Scene,
    private readonly config: typeof CONFIG,
    preloadedAssets: CriticalPreloadedAssets,
  ) {
    this.skyMesh = new SkyMesh(config);
    this.scene.add(this.skyMesh.mesh);

    this.starfield = new Starfield(config);
    this.scene.add(this.starfield.mesh);

    this.cloudLayer = new CloudLayer(config, preloadedAssets.cloudTexture);
    this.scene.add(this.cloudLayer.mesh);

    this.sun = new SunLight(config);
    this.scene.add(this.sun.light);
    this.scene.add(this.sun.target);

    this.moon = new Moon(config);
    this.scene.add(this.moon.sprite);
    this.scene.add(this.moon.halo);
    this.scene.add(this.moon.light);
    this.scene.add(this.moon.target);

    this.directionalFogStrengthUniform.value =
      config.sky.fog.directionalStrengthBase;

    this.hemisphereLight = new HemisphereLight(
      this.dayHemisphereSkyColor,
      this.dayHemisphereGroundColor,
      config.sky.lighting.hemisphereDayIntensity,
    );
    this.ambientLight = new AmbientLight(
      this.dayAmbientColor,
      config.sky.lighting.ambientDayIntensity,
    );
    this.scene.add(this.hemisphereLight);
    this.scene.add(this.ambientLight);

    this.scene.background = this.daySkyColor;
    this.scene.fog = new Fog(
      this.daySkyColor,
      config.sky.fog.dayNear,
      config.sky.fog.dayFar,
    );
  }

  update(dt: number, camera: PerspectiveCamera): void {
    const { sky } = this.config;

    if (this.timeOverrideSeconds !== null) {
      this.elapsedSeconds = this.timeOverrideSeconds;
    } else {
      this.elapsedSeconds =
        (this.elapsedSeconds + dt) % sky.dayCycleDurationSeconds;
    }

    const cycleProgress = this.elapsedSeconds / sky.dayCycleDurationSeconds;
    const angle = cycleProgress * Math.PI * 2 + sky.sunCyclePhaseOffsetRadians;

    this.lightAnchor.copy(camera.position);
    this.starfield.update(
      this.lightAnchor,
      this.elapsedSeconds,
      this.nightFactor,
    );

    this.sunOffset.set(
      Math.cos(angle) * sky.sun.orbitRadius,
      Math.sin(angle) * sky.sun.orbitRadius,
      sky.sun.orbitZOffset,
    );

    const sunHeight = this.sunOffset.y / sky.sun.orbitRadius;
    const dayFactor = MathUtils.smoothstep(sunHeight, -0.02, 0.08);
    const nightFactor = 1 - MathUtils.smoothstep(sunHeight, -0.04, 0.18);
    this.nightFactor = nightFactor;
    const twilightFactor = 1 - Math.abs(dayFactor * 2 - 1);
    const deepNightFactor = MathUtils.smoothstep(nightFactor, 0.62, 1);
    const sunLightFactor = Math.pow(Math.max(0, dayFactor), 3.35);
    const sunElevationFactor = MathUtils.smoothstep(
      Math.max(0, sunHeight),
      0.02,
      0.68,
    );
    const lowSunShadowBoost =
      1 -
      MathUtils.smoothstep(
        Math.max(0, sunHeight),
        sky.sun.shadowLowElevationMin,
        sky.sun.shadowLowElevationMax,
      );

    this.sunDirection.copy(this.sunOffset).normalize();
    this.moonDirection.copy(this.sunDirection).multiplyScalar(-1);

    if (this.directionalFogEnabled) {
      camera.updateMatrixWorld();
      this.directionalFogSunViewDirectionUniform.value
        .copy(this.sunDirection)
        .transformDirection(camera.matrixWorldInverse);
      this.directionalFogSunViewDirectionUniform.value.y = 0;
      if (this.directionalFogSunViewDirectionUniform.value.lengthSq() <= 1e-6) {
        this.directionalFogSunViewDirectionUniform.value.set(0, 0, -1);
      } else {
        this.directionalFogSunViewDirectionUniform.value.normalize();
      }
      this.directionalFogStrengthUniform.value = MathUtils.lerp(
        sky.fog.directionalStrengthBase,
        sky.fog.directionalStrengthLowSun,
        lowSunShadowBoost,
      );
    }

    this.skyMesh.update(
      this.lightAnchor,
      this.sunDirection,
      deepNightFactor,
      nightFactor,
      twilightFactor,
      dayFactor,
      this.elapsedSeconds,
    );

    this.sun.update(
      this.lightAnchor,
      this.sunDirection,
      sunElevationFactor,
      sunLightFactor,
      lowSunShadowBoost,
    );

    const moonElevation = Math.max(0, this.moonDirection.y);
    const moonGlowFactor = Math.pow(moonElevation, 1.2) * nightFactor;

    this.moon.update(
      this.lightAnchor,
      this.moonDirection,
      moonGlowFactor,
      nightFactor,
      moonElevation,
      this.sun.light.castShadow,
    );

    this.cloudLayer.update(
      dt,
      camera,
      this.elapsedSeconds,
      this.cloudDayColor,
      this.cloudTwilightColor,
      this.cloudNightColor,
      dayFactor,
      twilightFactor,
      nightFactor,
    );

    this.blendedSkyColor.lerpColors(
      this.daySkyColor,
      this.nightSkyColor,
      nightFactor,
    );
    this.blendedSkyColor.lerp(this.deepNightSkyColor, deepNightFactor * 0.72);
    this.scene.background = this.blendedSkyColor;

    if (this.scene.fog instanceof Fog) {
      this.scene.fog.near = MathUtils.lerp(
        sky.fog.dayNear,
        sky.fog.nightNear,
        nightFactor,
      );
      this.scene.fog.far = MathUtils.lerp(
        sky.fog.dayFar,
        sky.fog.nightFar,
        nightFactor,
      );
      this.scene.fog.color.copy(this.blendedSkyColor);
    }

    const twilightWarmth = twilightFactor * (1 - nightFactor * 0.45);
    this.hemisphereSkyColor.lerpColors(
      this.dayHemisphereSkyColor,
      this.nightHemisphereSkyColor,
      nightFactor,
    );
    this.hemisphereSkyColor.lerp(
      this.twilightHemisphereSkyColor,
      twilightWarmth * 0.65,
    );
    this.hemisphereGroundColor.lerpColors(
      this.dayHemisphereGroundColor,
      this.nightHemisphereGroundColor,
      nightFactor,
    );
    this.ambientColor.lerpColors(
      this.dayAmbientColor,
      this.nightAmbientColor,
      nightFactor,
    );
    this.ambientColor.lerp(this.twilightAmbientColor, twilightWarmth * 0.55);
    this.hemisphereLight.color.copy(this.hemisphereSkyColor);
    this.hemisphereLight.groundColor.copy(this.hemisphereGroundColor);
    this.ambientLight.color.copy(this.ambientColor);

    const moonFillBoost = moonGlowFactor * 0.08;
    const hemisphereBaseIntensity = MathUtils.lerp(
      sky.lighting.hemisphereDayIntensity,
      sky.lighting.hemisphereNightIntensity,
      nightFactor,
    );
    const ambientBaseIntensity = MathUtils.lerp(
      sky.lighting.ambientDayIntensity,
      sky.lighting.ambientNightIntensity,
      nightFactor,
    );
    this.hemisphereLight.intensity = hemisphereBaseIntensity + moonFillBoost;
    this.ambientLight.intensity = ambientBaseIntensity + moonFillBoost * 0.55;

    const baseExposure = MathUtils.lerp(
      sky.lighting.exposureDay,
      sky.lighting.exposureNight,
      nightFactor,
    );
    const twilightExposureLift =
      twilightFactor * sky.lighting.exposureTwilightLift;
    const moonExposureLift = moonGlowFactor * sky.lighting.exposureMoonLift;
    this.recommendedExposure = MathUtils.clamp(
      baseExposure + twilightExposureLift + moonExposureLift,
      sky.lighting.exposureMin,
      sky.lighting.exposureMax,
    );
  }

  getNightFactor(): number {
    return this.nightFactor;
  }

  getRecommendedExposure(): number {
    return this.recommendedExposure;
  }

  setTimeOverride(t: number | null): void {
    this.timeOverrideSeconds =
      t === null ? null : t * this.config.sky.dayCycleDurationSeconds;
    if (t !== null) {
      this.elapsedSeconds = this.timeOverrideSeconds!;
    }
  }

  getElapsedFraction(): number {
    return this.elapsedSeconds / this.config.sky.dayCycleDurationSeconds;
  }

  getDayCycleDurationSeconds(): number {
    return this.config.sky.dayCycleDurationSeconds;
  }

  getTimeOfDayHours(): number {
    const cycleProgress =
      this.elapsedSeconds / this.config.sky.dayCycleDurationSeconds;
    return (cycleProgress * 24 + 5.4) % 24;
  }

  enableDirectionalFog(): void {
    if (this.directionalFogEnabled) {
      return;
    }

    this.directionalFogEnabled = true;
    this.scene.traverse((object) => {
      const meshLike = object as Object3D & {
        material?: Material | Material[];
      };
      if (!meshLike.material) {
        return;
      }

      if (Array.isArray(meshLike.material)) {
        for (const material of meshLike.material) {
          this.patchDirectionalFogMaterial(material);
        }
        return;
      }

      this.patchDirectionalFogMaterial(meshLike.material);
    });
  }

  setTerrainHeightSampler(sampler: TerrainHeightSampler | null): void {
    this.cloudLayer.setTerrainHeightSampler(sampler);
  }

  dispose(): void {
    this.scene.remove(
      this.skyMesh.mesh,
      this.starfield.mesh,
      this.cloudLayer.mesh,
      this.moon.sprite,
      this.moon.halo,
      this.sun.light,
      this.moon.light,
      this.sun.target,
      this.moon.target,
      this.hemisphereLight,
      this.ambientLight,
    );

    this.skyMesh.dispose();
    this.starfield.dispose();
    this.cloudLayer.dispose();
    this.sun.dispose();
    this.moon.dispose();
  }

  private patchDirectionalFogMaterial(material: Material): void {
    if (this.directionalFogPatchedMaterials.has(material)) {
      return;
    }
    if (!(material as { fog?: boolean }).fog) {
      return;
    }

    this.directionalFogPatchedMaterials.add(material);
    const previousOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile.call(material, shader, renderer);

      const hasFogPars = shader.fragmentShader.includes(
        "#include <fog_pars_fragment>",
      );
      const hasFogFragment = shader.fragmentShader.includes(
        "#include <fog_fragment>",
      );
      if (!hasFogPars || !hasFogFragment) {
        return;
      }

      shader.uniforms.directionalFogSunViewDirection =
        this.directionalFogSunViewDirectionUniform;
      shader.uniforms.directionalFogStrength =
        this.directionalFogStrengthUniform;

      if (shader.fragmentShader.includes("directionalFogSunViewDirection")) {
        return;
      }

      shader.fragmentShader = shader.fragmentShader
        .replace("#include <fog_pars_fragment>", directionalFogPars())
        .replace("#include <fog_fragment>", directionalFogFragment());
    };

    const previousCacheKey = (material as any).customProgramCacheKey;
    (material as any).customProgramCacheKey = function () {
      const base = previousCacheKey ? previousCacheKey.call(this) : "";
      return base + "-directional-fog";
    };

    material.needsUpdate = true;
  }
}
