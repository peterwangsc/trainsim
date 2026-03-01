import { DirectionalLight, MathUtils, Object3D, OrthographicCamera, Color, Vector3 } from "three";
import type { CONFIG } from "../../game/Config";

export class SunLight {
  public readonly light: DirectionalLight;
  public readonly target: Object3D;

  private readonly sunLightColor = new Color();
  private readonly sunriseLightColor = new Color("#fff4d6");
  private readonly noonLightColor = new Color("#ffffff");

  private sunShadowHalfExtent: number;
  private sunShadowFar: number;

  constructor(private readonly config: typeof CONFIG) {
    const { sun } = this.config.sky;
    this.light = new DirectionalLight("#fff4d6", sun.lightDayIntensity);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);

    const shadowCamera = this.light.shadow.camera as OrthographicCamera;
    shadowCamera.near = sun.shadowCameraNear;
    shadowCamera.far = sun.shadowCameraFarMin;
    shadowCamera.left = -sun.shadowFrustumHalfExtentMin;
    shadowCamera.right = sun.shadowFrustumHalfExtentMin;
    shadowCamera.top = sun.shadowFrustumHalfExtentMin;
    shadowCamera.bottom = -sun.shadowFrustumHalfExtentMin;
    shadowCamera.updateProjectionMatrix();

    this.light.shadow.bias = sun.shadowBiasDay;
    this.light.shadow.normalBias = sun.shadowNormalBiasDay;

    this.target = new Object3D();
    this.light.target = this.target;

    this.sunShadowHalfExtent = sun.shadowFrustumHalfExtentMin;
    this.sunShadowFar = sun.shadowCameraFarMin;
  }

  update(
    lightAnchor: Vector3,
    sunDirection: Vector3,
    sunElevationFactor: number,
    sunLightFactor: number,
    lowSunShadowBoost: number,
  ): void {
    const { sun } = this.config.sky;

    const sunShadowDistance = MathUtils.lerp(
      sun.shadowLightDistanceMin,
      sun.shadowLightDistanceMax,
      lowSunShadowBoost,
    );
    const sunShadowHalfExtent = MathUtils.lerp(
      sun.shadowFrustumHalfExtentMin,
      sun.shadowFrustumHalfExtentMax,
      lowSunShadowBoost,
    );
    const sunShadowFar = MathUtils.clamp(
      sunShadowDistance + 360,
      sun.shadowCameraFarMin,
      sun.shadowCameraFarMax,
    );

    this.updateSunShadowFrustum(sunShadowHalfExtent, sunShadowFar);

    this.light.shadow.bias = MathUtils.lerp(
      sun.shadowBiasDay,
      sun.shadowBiasLow,
      lowSunShadowBoost,
    );
    this.light.shadow.normalBias = MathUtils.lerp(
      sun.shadowNormalBiasDay,
      sun.shadowNormalBiasLow,
      lowSunShadowBoost,
    );

    this.light.position
      .copy(lightAnchor)
      .addScaledVector(sunDirection, sunShadowDistance);
    this.target.position.copy(lightAnchor);
    this.target.updateMatrixWorld();

    this.light.intensity = sun.lightDayIntensity * sunLightFactor;
    this.light.castShadow = sunLightFactor > sun.shadowEnableThreshold;

    this.sunLightColor.lerpColors(
      this.sunriseLightColor,
      this.noonLightColor,
      sunElevationFactor,
    );
    this.light.color.copy(this.sunLightColor);
  }

  dispose(): void {
    this.light.dispose();
  }

  private updateSunShadowFrustum(halfExtent: number, far: number): void {
    const shouldUpdate =
      Math.abs(this.sunShadowHalfExtent - halfExtent) > 0.5 ||
      Math.abs(this.sunShadowFar - far) > 1;

    if (!shouldUpdate) {
      return;
    }

    this.sunShadowHalfExtent = halfExtent;
    this.sunShadowFar = far;
    
    const shadowCamera = this.light.shadow.camera as OrthographicCamera;
    shadowCamera.left = -halfExtent;
    shadowCamera.right = halfExtent;
    shadowCamera.top = halfExtent;
    shadowCamera.bottom = -halfExtent;
    shadowCamera.far = far;
    shadowCamera.updateProjectionMatrix();
  }
}
