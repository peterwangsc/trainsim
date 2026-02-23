import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Fog,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshLambertMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  PerspectiveCamera,
  Points,
  Quaternion,
  REVISION,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Spherical,
  Texture,
  Vector3,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

const DEFAULT_DAY_CYCLE_DURATION_SECONDS = 300;
const SUN_CYCLE_PHASE_OFFSET_RADIANS = Math.PI * 1.95;

const SKY_DOME_SCALE = 16000;
const STAR_RADIUS = 820;
const STAR_DEPTH = 560;
const STAR_COUNT = 5000;
const STAR_SATURATION = 0;
const STAR_SIZE_FACTOR = 32;
const STAR_TWINKLE_SPEED = 1;
const STAR_TWINKLE_RATE_MIN = 0.65;
const STAR_TWINKLE_RATE_MAX = 1.45;
const STAR_SOFT_FADE = true;

const SUN_ORBIT_RADIUS = 700;
const SUN_ORBIT_Z_OFFSET = 180;
const SUN_VISUAL_DISTANCE = 5600;
const MOON_VISUAL_DISTANCE = 6200;
const SUN_SHADOW_LIGHT_DISTANCE_MIN = 260;
const SUN_SHADOW_LIGHT_DISTANCE_MAX = 900;
const SUN_SHADOW_CAMERA_NEAR = 0.5;
const SUN_SHADOW_CAMERA_FAR_MIN = 420;
const SUN_SHADOW_CAMERA_FAR_MAX = 1820;
const SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN = 140;
const SUN_SHADOW_FRUSTUM_HALF_EXTENT_MAX = 240;
const SUN_SHADOW_LOW_ELEVATION_MIN = 0.08;
const SUN_SHADOW_LOW_ELEVATION_MAX = 0.62;
const SUN_SHADOW_BIAS_DAY = -0.00035;
const SUN_SHADOW_BIAS_LOW = -0.00022;
const SUN_SHADOW_NORMAL_BIAS_DAY = 0.03;
const SUN_SHADOW_NORMAL_BIAS_LOW = 0.09;
const MOON_SHADOW_LIGHT_DISTANCE = 260;
const MOON_DISC_SIZE = 192;

const DAY_FOG_NEAR = 68;
const DAY_FOG_FAR = 900;
const NIGHT_FOG_NEAR = 38;
const NIGHT_FOG_FAR = 290;

const MOON_HALO_BASE_SCALE = 6.2;
const MOON_HALO_PULSE_SCALE = 9.6;
const SKY_CLOUD_TIME_SCALE = 0.45;
const SKY_CLOUD_COVERAGE_DAY = 0.24;
const SKY_CLOUD_COVERAGE_TWILIGHT = 0.58;
const SKY_CLOUD_DENSITY_DAY = 0.28;
const SKY_CLOUD_DENSITY_TWILIGHT = 0.62;
const SKY_CLOUD_ELEVATION_DAY = 0.56;
const SKY_CLOUD_ELEVATION_NIGHT = 0.44;
const CLOUD_SPRITE_LIMIT = 90;
const CLOUD_LAYER_RADIUS = 540;
const CLOUD_WRAP_RADIUS = 620;
const CLOUD_FADE_RADIUS = 760;
const CLOUD_ALTITUDE_MIN = 180;
const CLOUD_ALTITUDE_VARIATION = 220;
const CLOUD_VOLUME_MIN = 74;
const CLOUD_VOLUME_MAX = 180;
const CLOUD_GROWTH_MIN = 18;
const CLOUD_GROWTH_MAX = 54;
const CLOUD_DENSITY_MIN = 0.24;
const CLOUD_DENSITY_MAX = 0.82;
const CLOUD_DRIFT_SPEED_MIN = 1.4;
const CLOUD_DRIFT_SPEED_MAX = 6.1;
const CLOUD_ROTATION_FACTOR_MIN = -0.1;
const CLOUD_ROTATION_FACTOR_MAX = 0.1;
const CLOUD_OPACITY_MIN = 0.23;
const CLOUD_OPACITY_MAX = 0.58;
const CLOUD_BRIGHTNESS_MIN = 0.84;
const CLOUD_BRIGHTNESS_MAX = 1.18;

const SUN_LIGHT_DAY_INTENSITY = 5.55;
const SUN_SHADOW_ENABLE_THRESHOLD = 0.1;
const MOON_LIGHT_MAX_INTENSITY = 2.22;
const MOON_SHADOW_ENABLE_THRESHOLD = 0.16;
const HEMISPHERE_DAY_INTENSITY = 0.58;
const HEMISPHERE_NIGHT_INTENSITY = 0.05;
const AMBIENT_DAY_INTENSITY = 0.64;
const AMBIENT_NIGHT_INTENSITY = 0.055;
const EXPOSURE_DAY = 0.56;
const EXPOSURE_NIGHT = 0.46;
const EXPOSURE_TWILIGHT_LIFT = 0.08;
const EXPOSURE_MOON_LIFT = 0.06;
const EXPOSURE_MIN = 0.8;
const EXPOSURE_MAX = 1.06;

type DayNightSkyOptions = {
  dayCycleDurationSeconds?: number;
  cloudTexture: Texture;
};

type SkyUniforms = {
  turbidity: { value: number };
  rayleigh: { value: number };
  mieCoefficient: { value: number };
  mieDirectionalG: { value: number };
  sunPosition: { value: Vector3 };
  cloudCoverage: { value: number };
  cloudDensity: { value: number };
  cloudElevation: { value: number };
  cloudNightFactor: { value: number };
  time: { value: number };
};

type SpriteCloudInstance = {
  matrix: Matrix4;
  position: Vector3;
  driftDirection: Vector3;
  driftSpeed: number;
  rotation: number;
  rotationFactor: number;
  volume: number;
  growth: number;
  density: number;
  opacity: number;
  brightness: number;
  dist: number;
};

type SpriteCloudLayer = {
  mesh: InstancedMesh<PlaneGeometry, MeshLambertMaterial>;
  material: MeshLambertMaterial;
  texture: Texture;
  opacities: Float32Array;
  opacityAttribute: InstancedBufferAttribute;
  instances: SpriteCloudInstance[];
};

type StarfieldUniforms = {
  time: { value: number };
  fade: { value: number };
  alpha: { value: number };
};

class StarfieldMaterial extends ShaderMaterial {
  declare uniforms: StarfieldUniforms;

  constructor(fade: boolean) {
    const colorSpaceInclude =
      Number.parseInt(REVISION.replace(/\D+/g, ""), 10) >= 154
        ? "colorspace_fragment"
        : "encodings_fragment";

    super({
      uniforms: {
        time: { value: 0 },
        fade: { value: fade ? 1 : 0 },
        alpha: { value: 1 },
      },
      vertexShader: /* glsl */ `
uniform float time;
attribute float size;
attribute vec2 twinkle;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  vColor = color;
  float twinkleWave = sin(time * twinkle.y + twinkle.x);
  float twinkleSize = 3.0 + twinkleWave * 0.8;
  vTwinkle = 0.78 + twinkleWave * 0.22;
  vec4 mvPosition = modelViewMatrix * vec4(position, 0.5);
  gl_PointSize = size * (30.0 / -mvPosition.z) * twinkleSize;
  gl_Position = projectionMatrix * mvPosition;
}
`,
      fragmentShader: /* glsl */ `
uniform float fade;
uniform float alpha;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  float opacity = 1.0;
  if (fade == 1.0) {
    float d = distance(gl_PointCoord, vec2(0.5, 0.5));
    opacity = 1.0 / (1.0 + exp(16.0 * (d - 0.25)));
  }

  gl_FragColor = vec4(vColor, opacity * alpha * vTwinkle);

  #include <tonemapping_fragment>
  #include <${colorSpaceInclude}>
}
`,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
      fog: false,
    });
  }
}

export class DayNightSky {
  readonly ambientLight: AmbientLight;
  readonly hemisphereLight: HemisphereLight;
  readonly sunLight: DirectionalLight;
  readonly moonLight: DirectionalLight;

  private readonly daySkyColor = new Color("#7fbbff");
  private readonly nightSkyColor = new Color("#071634");
  private readonly deepNightSkyColor = new Color("#02060f");
  private readonly blendedSkyColor = new Color("#7fbbff");
  private readonly sunriseLightColor = new Color("#fff4d6");
  private readonly noonLightColor = new Color("#ffffff");
  private readonly dayHemisphereSkyColor = new Color("#dcefff");
  private readonly twilightHemisphereSkyColor = new Color("#ffd0a0");
  private readonly nightHemisphereSkyColor = new Color("#1a2a4c");
  private readonly dayHemisphereGroundColor = new Color("#7f9468");
  private readonly nightHemisphereGroundColor = new Color("#0f1624");
  private readonly dayAmbientColor = new Color("#cfe0ff");
  private readonly twilightAmbientColor = new Color("#b49ab6");
  private readonly nightAmbientColor = new Color("#1d2f54");
  private readonly cloudDayColor = new Color("#f4f7ff");
  private readonly cloudTwilightColor = new Color("#ffe0c2");
  private readonly cloudNightColor = new Color("#8a9fca");
  private readonly moonLowColor = new Color("#9fb6de");
  private readonly moonHighColor = new Color("#e9f1ff");

  private readonly dayCycleDurationSeconds: number;
  private readonly sky: Sky;
  private readonly skyMaterial: ShaderMaterial;
  private readonly skyUniforms: SkyUniforms;

  private readonly stars: Points;
  private readonly starsMaterial: StarfieldMaterial;
  private readonly spriteCloudLayer: SpriteCloudLayer;

  private readonly moonSprite: Sprite;
  private readonly moonMaterial: SpriteMaterial;
  private readonly moonHalo: Sprite;
  private readonly moonHaloMaterial: SpriteMaterial;
  private readonly moonDiscTexture: CanvasTexture;
  private readonly moonGlowTexture: CanvasTexture;

  private readonly sunTarget = new Object3D();
  private readonly moonTarget = new Object3D();

  private readonly lightAnchor = new Vector3();
  private readonly sunOffset = new Vector3();
  private readonly sunDirection = new Vector3();
  private readonly moonDirection = new Vector3();
  private readonly moonVisualPosition = new Vector3();
  private readonly uniformSunPosition = new Vector3();
  private readonly sunLightColor = new Color();
  private readonly hemisphereSkyColor = new Color();
  private readonly hemisphereGroundColor = new Color();
  private readonly ambientColor = new Color();
  private readonly moonLightColor = new Color();
  private readonly cloudColor = new Color();
  private readonly cloudInstanceColor = new Color();
  private readonly cloudBillboardQuaternion = new Quaternion();
  private readonly cloudSpinQuaternion = new Quaternion();
  private readonly cloudScale = new Vector3();
  private readonly cloudForward = new Vector3(0, 0, 1);
  private sunShadowHalfExtent = SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN;
  private sunShadowFar = SUN_SHADOW_CAMERA_FAR_MIN;

  private elapsedSeconds = 0;
  private nightFactor = 0;
  private recommendedExposure = EXPOSURE_DAY;

  constructor(
    private readonly scene: Scene,
    options: DayNightSkyOptions,
  ) {
    this.dayCycleDurationSeconds = Math.max(
      10,
      options.dayCycleDurationSeconds ?? DEFAULT_DAY_CYCLE_DURATION_SECONDS,
    );

    this.sky = new Sky();
    this.sky.scale.setScalar(SKY_DOME_SCALE);
    this.sky.frustumCulled = false;
    this.skyMaterial = this.sky.material as ShaderMaterial;
    this.ensureSkyCloudUniforms();
    this.skyUniforms = this.skyMaterial.uniforms as unknown as SkyUniforms;
    this.skyUniforms.turbidity.value = 0.8;
    this.skyUniforms.rayleigh.value = 0.2;
    this.skyUniforms.mieCoefficient.value = 0.0002;
    this.skyUniforms.mieDirectionalG.value = 0.999;
    this.skyUniforms.cloudCoverage.value = 0.4;
    this.skyUniforms.cloudDensity.value = 0.45;
    this.skyUniforms.cloudElevation.value = 0.5;
    this.skyUniforms.cloudNightFactor.value = 0;
    this.skyUniforms.time.value = 0;
    this.scene.add(this.sky);

    this.stars = this.createStarField();
    this.starsMaterial = this.stars.material as StarfieldMaterial;
    this.scene.add(this.stars);

    this.spriteCloudLayer = this.createSpriteCloudLayer(options.cloudTexture);
    this.scene.add(this.spriteCloudLayer.mesh);

    this.moonDiscTexture = this.createMoonDiscTexture();
    this.moonGlowTexture = this.createMoonGlowTexture();

    this.moonMaterial = new SpriteMaterial({
      map: this.moonDiscTexture,
      color: "#f6f9ff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    });
    this.moonSprite = new Sprite(this.moonMaterial);
    this.moonSprite.scale.set(MOON_DISC_SIZE, MOON_DISC_SIZE, 1);
    this.moonSprite.frustumCulled = false;
    this.moonSprite.renderOrder = 11;
    this.scene.add(this.moonSprite);

    this.moonHaloMaterial = new SpriteMaterial({
      map: this.moonGlowTexture,
      color: "#cde0ff",
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    });
    this.moonHalo = new Sprite(this.moonHaloMaterial);
    this.moonHalo.scale.set(
      MOON_DISC_SIZE * MOON_HALO_BASE_SCALE,
      MOON_DISC_SIZE * MOON_HALO_BASE_SCALE,
      1,
    );
    this.moonHalo.frustumCulled = false;
    this.moonHalo.renderOrder = 10;
    this.scene.add(this.moonHalo);

    this.sunLight = new DirectionalLight("#fff4d6", SUN_LIGHT_DAY_INTENSITY);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const sunShadowCamera = this.sunLight.shadow.camera as OrthographicCamera;
    sunShadowCamera.near = SUN_SHADOW_CAMERA_NEAR;
    sunShadowCamera.far = SUN_SHADOW_CAMERA_FAR_MIN;
    sunShadowCamera.left = -SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN;
    sunShadowCamera.right = SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN;
    sunShadowCamera.top = SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN;
    sunShadowCamera.bottom = -SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN;
    sunShadowCamera.updateProjectionMatrix();
    this.sunLight.shadow.bias = SUN_SHADOW_BIAS_DAY;
    this.sunLight.shadow.normalBias = SUN_SHADOW_NORMAL_BIAS_DAY;
    this.sunLight.target = this.sunTarget;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunTarget);

    this.moonLight = new DirectionalLight("#b0c4de", MOON_LIGHT_MAX_INTENSITY);
    this.moonLight.castShadow = false;
    this.moonLight.shadow.mapSize.set(512, 512);
    const moonShadowCamera = this.moonLight.shadow.camera as OrthographicCamera;
    moonShadowCamera.near = 0.5;
    moonShadowCamera.far = 420;
    moonShadowCamera.left = -120;
    moonShadowCamera.right = 120;
    moonShadowCamera.top = 120;
    moonShadowCamera.bottom = -120;
    moonShadowCamera.updateProjectionMatrix();
    this.moonLight.shadow.bias = -0.00025;
    this.moonLight.shadow.normalBias = 0.025;
    this.moonLight.target = this.moonTarget;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonTarget);

    this.hemisphereLight = new HemisphereLight(
      this.dayHemisphereSkyColor,
      this.dayHemisphereGroundColor,
      HEMISPHERE_DAY_INTENSITY,
    );
    this.ambientLight = new AmbientLight(
      this.dayAmbientColor,
      AMBIENT_DAY_INTENSITY,
    );
    this.scene.add(this.hemisphereLight);
    this.scene.add(this.ambientLight);

    this.scene.background = this.daySkyColor;
    this.scene.fog = new Fog(this.daySkyColor, DAY_FOG_NEAR, DAY_FOG_FAR);
  }

  update(dt: number, camera: PerspectiveCamera): void {
    this.elapsedSeconds =
      (this.elapsedSeconds + dt) % this.dayCycleDurationSeconds;

    const cycleProgress = this.elapsedSeconds / this.dayCycleDurationSeconds;
    const angle = cycleProgress * Math.PI * 2 + SUN_CYCLE_PHASE_OFFSET_RADIANS;

    this.lightAnchor.copy(camera.position);
    this.sky.position.copy(this.lightAnchor);
    this.stars.position.copy(this.lightAnchor);
    this.starsMaterial.uniforms.time.value =
      this.elapsedSeconds * STAR_TWINKLE_SPEED;

    this.sunOffset.set(
      Math.cos(angle) * SUN_ORBIT_RADIUS,
      Math.sin(angle) * SUN_ORBIT_RADIUS,
      SUN_ORBIT_Z_OFFSET,
    );

    const sunHeight = this.sunOffset.y / SUN_ORBIT_RADIUS;
    const dayFactor = MathUtils.smoothstep(sunHeight, -0.02, 0.08);
    const nightFactor = 1 - MathUtils.smoothstep(sunHeight, -0.04, 0.18);
    this.nightFactor = nightFactor;
    const twilightFactor = 1 - Math.abs(dayFactor * 2 - 1);
    const deepNightFactor = MathUtils.smoothstep(nightFactor, 0.62, 1);
    const sunLightFactor = Math.pow(Math.max(0, dayFactor), 3.35);

    this.sunDirection.copy(this.sunOffset).normalize();
    this.moonDirection.copy(this.sunDirection).multiplyScalar(-1);
    this.updateSpriteClouds(dt, camera, dayFactor, twilightFactor, nightFactor);

    this.uniformSunPosition
      .copy(this.sunDirection)
      .multiplyScalar(SUN_VISUAL_DISTANCE);
    this.skyUniforms.sunPosition.value.copy(this.uniformSunPosition);
    const deepNightScatteringDarken = MathUtils.lerp(1, 0.56, deepNightFactor);
    this.skyUniforms.turbidity.value =
      MathUtils.lerp(2.0, 10.0, nightFactor) *
      MathUtils.lerp(1, 0.88, deepNightFactor);
    this.skyUniforms.rayleigh.value =
      MathUtils.lerp(0.5, 3.5, nightFactor) * deepNightScatteringDarken;
    this.skyUniforms.mieCoefficient.value =
      MathUtils.lerp(0.00001, 0.65, nightFactor) * deepNightScatteringDarken;
    this.skyUniforms.mieDirectionalG.value = MathUtils.lerp(
      0.05,
      0.7,
      nightFactor,
    );
    this.skyUniforms.cloudCoverage.value = MathUtils.lerp(
      SKY_CLOUD_COVERAGE_DAY,
      SKY_CLOUD_COVERAGE_TWILIGHT,
      twilightFactor,
    );
    this.skyUniforms.cloudDensity.value = MathUtils.lerp(
      SKY_CLOUD_DENSITY_DAY,
      SKY_CLOUD_DENSITY_TWILIGHT,
      twilightFactor,
    );
    this.skyUniforms.cloudElevation.value = MathUtils.lerp(
      SKY_CLOUD_ELEVATION_NIGHT,
      SKY_CLOUD_ELEVATION_DAY,
      dayFactor,
    );
    this.skyUniforms.cloudNightFactor.value = MathUtils.smoothstep(
      nightFactor,
      0.22,
      0.86,
    );
    this.skyUniforms.time.value = this.elapsedSeconds * SKY_CLOUD_TIME_SCALE;

    this.blendedSkyColor.lerpColors(
      this.daySkyColor,
      this.nightSkyColor,
      nightFactor,
    );
    this.blendedSkyColor.lerp(this.deepNightSkyColor, deepNightFactor * 0.72);
    this.scene.background = this.blendedSkyColor;

    if (this.scene.fog instanceof Fog) {
      this.scene.fog.near = MathUtils.lerp(
        DAY_FOG_NEAR,
        NIGHT_FOG_NEAR,
        nightFactor,
      );
      this.scene.fog.far = MathUtils.lerp(
        DAY_FOG_FAR,
        NIGHT_FOG_FAR,
        nightFactor,
      );
      this.scene.fog.color.copy(this.blendedSkyColor);
    }

    const sunElevationFactor = MathUtils.smoothstep(
      Math.max(0, sunHeight),
      0.02,
      0.68,
    );
    const lowSunShadowBoost =
      1 -
      MathUtils.smoothstep(
        Math.max(0, sunHeight),
        SUN_SHADOW_LOW_ELEVATION_MIN,
        SUN_SHADOW_LOW_ELEVATION_MAX,
      );
    const sunShadowDistance = MathUtils.lerp(
      SUN_SHADOW_LIGHT_DISTANCE_MIN,
      SUN_SHADOW_LIGHT_DISTANCE_MAX,
      lowSunShadowBoost,
    );
    const sunShadowHalfExtent = MathUtils.lerp(
      SUN_SHADOW_FRUSTUM_HALF_EXTENT_MIN,
      SUN_SHADOW_FRUSTUM_HALF_EXTENT_MAX,
      lowSunShadowBoost,
    );
    const sunShadowFar = MathUtils.clamp(
      sunShadowDistance + 360,
      SUN_SHADOW_CAMERA_FAR_MIN,
      SUN_SHADOW_CAMERA_FAR_MAX,
    );
    this.updateSunShadowFrustum(sunShadowHalfExtent, sunShadowFar);
    this.sunLight.shadow.bias = MathUtils.lerp(
      SUN_SHADOW_BIAS_DAY,
      SUN_SHADOW_BIAS_LOW,
      lowSunShadowBoost,
    );
    this.sunLight.shadow.normalBias = MathUtils.lerp(
      SUN_SHADOW_NORMAL_BIAS_DAY,
      SUN_SHADOW_NORMAL_BIAS_LOW,
      lowSunShadowBoost,
    );

    this.sunLight.position
      .copy(this.lightAnchor)
      .addScaledVector(this.sunDirection, sunShadowDistance);
    this.sunTarget.position.copy(this.lightAnchor);
    this.sunTarget.updateMatrixWorld();
    this.sunLight.intensity = SUN_LIGHT_DAY_INTENSITY * sunLightFactor;
    this.sunLight.castShadow = sunLightFactor > SUN_SHADOW_ENABLE_THRESHOLD;
    this.sunLightColor.lerpColors(
      this.sunriseLightColor,
      this.noonLightColor,
      sunElevationFactor,
    );
    this.sunLight.color.copy(this.sunLightColor);

    const moonElevation = Math.max(0, this.moonDirection.y);
    const moonGlowFactor = Math.pow(moonElevation, 1.2) * nightFactor;

    this.moonLight.position
      .copy(this.lightAnchor)
      .addScaledVector(this.moonDirection, MOON_SHADOW_LIGHT_DISTANCE);
    this.moonTarget.position.copy(this.lightAnchor);
    this.moonTarget.updateMatrixWorld();
    this.moonLight.intensity = moonGlowFactor * MOON_LIGHT_MAX_INTENSITY;
    this.moonLight.castShadow =
      !this.sunLight.castShadow &&
      moonGlowFactor > MOON_SHADOW_ENABLE_THRESHOLD;
    this.moonLightColor.lerpColors(
      this.moonLowColor,
      this.moonHighColor,
      moonElevation,
    );
    this.moonLight.color.copy(this.moonLightColor);

    this.moonVisualPosition
      .copy(this.lightAnchor)
      .addScaledVector(this.moonDirection, MOON_VISUAL_DISTANCE);
    this.moonSprite.position.copy(this.moonVisualPosition);
    this.moonMaterial.opacity = MathUtils.lerp(0.9, 0.96, nightFactor);

    this.moonHalo.position.copy(this.moonVisualPosition);
    const haloScale = MathUtils.lerp(
      MOON_HALO_BASE_SCALE,
      MOON_HALO_PULSE_SCALE,
      Math.sqrt(moonGlowFactor),
    );
    const haloSize = MOON_DISC_SIZE * haloScale;
    this.moonHalo.scale.set(haloSize, haloSize, 1);
    this.moonHaloMaterial.opacity = Math.pow(moonGlowFactor, 0.85) * 0.88;

    this.stars.visible = nightFactor > 0.01;
    this.starsMaterial.uniforms.alpha.value = nightFactor * 0.95;

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
      HEMISPHERE_DAY_INTENSITY,
      HEMISPHERE_NIGHT_INTENSITY,
      nightFactor,
    );
    const ambientBaseIntensity = MathUtils.lerp(
      AMBIENT_DAY_INTENSITY,
      AMBIENT_NIGHT_INTENSITY,
      nightFactor,
    );
    this.hemisphereLight.intensity = hemisphereBaseIntensity + moonFillBoost;
    this.ambientLight.intensity = ambientBaseIntensity + moonFillBoost * 0.55;

    const baseExposure = MathUtils.lerp(
      EXPOSURE_DAY,
      EXPOSURE_NIGHT,
      nightFactor,
    );
    const twilightExposureLift = twilightFactor * EXPOSURE_TWILIGHT_LIFT;
    const moonExposureLift = moonGlowFactor * EXPOSURE_MOON_LIFT;
    this.recommendedExposure = MathUtils.clamp(
      baseExposure + twilightExposureLift + moonExposureLift,
      EXPOSURE_MIN,
      EXPOSURE_MAX,
    );
  }

  getNightFactor(): number {
    return this.nightFactor;
  }

  getRecommendedExposure(): number {
    return this.recommendedExposure;
  }

  dispose(): void {
    this.scene.remove(
      this.sky,
      this.stars,
      this.spriteCloudLayer.mesh,
      this.moonSprite,
      this.moonHalo,
      this.sunLight,
      this.moonLight,
      this.sunTarget,
      this.moonTarget,
      this.hemisphereLight,
      this.ambientLight,
    );

    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.stars.geometry.dispose();
    this.starsMaterial.dispose();
    this.spriteCloudLayer.mesh.geometry.dispose();
    this.spriteCloudLayer.material.dispose();
    this.spriteCloudLayer.texture.dispose();
    this.moonMaterial.dispose();
    this.moonHaloMaterial.dispose();
    this.moonDiscTexture.dispose();
    this.moonGlowTexture.dispose();
  }

  private ensureSkyCloudUniforms(): void {
    const uniforms = this.skyMaterial.uniforms as Record<
      string,
      { value: number | Vector3 }
    >;
    uniforms.cloudCoverage ??= { value: 0.4 };
    uniforms.cloudDensity ??= { value: 0.4 };
    uniforms.cloudElevation ??= { value: 0.5 };
    uniforms.cloudNightFactor ??= { value: 0 };
    uniforms.time ??= { value: 0 };

    const hasCloudUniformsInShader =
      this.skyMaterial.fragmentShader.includes(
        "uniform float cloudCoverage;",
      ) &&
      this.skyMaterial.fragmentShader.includes("uniform float cloudDensity;") &&
      this.skyMaterial.fragmentShader.includes(
        "uniform float cloudElevation;",
      ) &&
      this.skyMaterial.fragmentShader.includes(
        "uniform float cloudNightFactor;",
      ) &&
      this.skyMaterial.fragmentShader.includes("uniform float time;");

    if (hasCloudUniformsInShader) {
      return;
    }

    let fragmentShader = this.skyMaterial.fragmentShader;

    fragmentShader = fragmentShader.replace(
      "uniform vec3 up;",
      `uniform vec3 up;
		uniform float cloudCoverage;
		uniform float cloudDensity;
		uniform float cloudElevation;
		uniform float cloudNightFactor;
		uniform float time;`,
    );

    fragmentShader = fragmentShader.replace(
      "void main() {",
      `float hash2( vec2 p ) {
			return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
		}

		float noise2( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * ( 3.0 - 2.0 * f );
			return mix(
				mix( hash2( i + vec2( 0.0, 0.0 ) ), hash2( i + vec2( 1.0, 0.0 ) ), u.x ),
				mix( hash2( i + vec2( 0.0, 1.0 ) ), hash2( i + vec2( 1.0, 1.0 ) ), u.x ),
				u.y
			);
		}

		float fbm2( vec2 p ) {
			float value = 0.0;
			float amplitude = 0.5;

			for ( int i = 0; i < 5; i ++ ) {
				value += noise2( p ) * amplitude;
				p = p * 2.03 + vec2( 13.7, 7.1 );
				amplitude *= 0.5;
			}

			return value;
		}

		void main() {`,
    );

    fragmentShader = fragmentShader.replace(
      "vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );",
      `vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

			vec2 skyUv = uv - vec2( 0.5 );
			vec2 rotatedSkyUv = vec2( skyUv.y, -skyUv.x );
			vec2 cloudUv = rotatedSkyUv * 8.0 + vec2( -time * 0.006, 0.0 );
			float cloudField = fbm2( cloudUv + fbm2( cloudUv * 0.57 ) * 0.35 );
			float cloudShape = smoothstep(
				1.0 - cloudCoverage - cloudDensity * 0.55,
				1.0 - cloudCoverage + 0.12,
				cloudField
			);
			float horizonMask = smoothstep( cloudElevation - 0.28, cloudElevation + 0.35, uv.y );
			float cloudMask = cloudShape * horizonMask;
				vec3 cloudTintDay = mix(
					vec3( 1.0 ),
					vec3( 1.25, 0.72, 0.42 ),
					clamp( 1.0 - direction.y * 1.4, 0.0, 1.0 )
				);
				vec3 cloudTintNight = mix(
					vec3( 0.74, 0.81, 0.95 ),
					vec3( 0.58, 0.66, 0.8 ),
					clamp( 1.0 - direction.y * 1.2, 0.0, 1.0 )
				);
				vec3 cloudTint = mix( cloudTintDay, cloudTintNight, cloudNightFactor );
				float cloudDensityMix = cloudDensity * mix( 1.0, 0.35, cloudNightFactor );
				float cloudDarken = mix( 0.6, 0.78, cloudNightFactor );
				float cloudTintStrength = mix( 0.08, 0.03, cloudNightFactor );
				texColor = mix(
					texColor,
					texColor * cloudDarken + cloudTint * cloudTintStrength,
					cloudMask * cloudDensityMix
				);`,
    );

    this.skyMaterial.fragmentShader = fragmentShader;
    this.skyMaterial.needsUpdate = true;
  }

  private createMoonDiscTexture(): CanvasTexture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");

    if (context) {
      const center = size * 0.5;
      const radius = size * 0.46;
      const discGradient = context.createRadialGradient(
        center - size * 0.08,
        center - size * 0.1,
        size * 0.03,
        center,
        center,
        radius,
      );
      discGradient.addColorStop(0, "rgba(255,255,255,1)");
      discGradient.addColorStop(0.55, "rgba(246,251,255,0.99)");
      discGradient.addColorStop(1, "rgba(214,224,242,0.97)");
      context.fillStyle = discGradient;
      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.fill();

      context.globalCompositeOperation = "multiply";
      const craterPattern: Array<[number, number, number, number]> = [
        [-0.17, -0.09, 0.08, 0.15],
        [0.11, -0.13, 0.07, 0.18],
        [-0.06, 0.05, 0.1, 0.14],
        [0.19, 0.08, 0.06, 0.12],
        [-0.2, 0.16, 0.05, 0.11],
        [0.01, 0.2, 0.07, 0.13],
      ];
      for (const [x, y, r, alpha] of craterPattern) {
        const craterRadius = size * r;
        const craterX = center + x * size;
        const craterY = center + y * size;
        const craterGradient = context.createRadialGradient(
          craterX - craterRadius * 0.2,
          craterY - craterRadius * 0.2,
          craterRadius * 0.2,
          craterX,
          craterY,
          craterRadius,
        );
        craterGradient.addColorStop(0, `rgba(110,118,132,${alpha})`);
        craterGradient.addColorStop(1, "rgba(110,118,132,0)");
        context.fillStyle = craterGradient;
        context.beginPath();
        context.arc(craterX, craterY, craterRadius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalCompositeOperation = "source-over";
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createMoonGlowTexture(): CanvasTexture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");

    if (context) {
      const center = size * 0.5;
      const glow = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        size * 0.5,
      );
      glow.addColorStop(0, "rgba(214,230,255,0.48)");
      glow.addColorStop(0.2, "rgba(201,220,255,0.32)");
      glow.addColorStop(0.5, "rgba(173,199,244,0.14)");
      glow.addColorStop(0.8, "rgba(144,171,221,0.04)");
      glow.addColorStop(1, "rgba(144,171,221,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createSpriteCloudLayer(preloadedTexture: Texture): SpriteCloudLayer {
    const texture = preloadedTexture;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;

    const geometry = new PlaneGeometry(1, 1);
    const opacities = new Float32Array(CLOUD_SPRITE_LIMIT);
    opacities.fill(1);
    const opacityAttribute = new InstancedBufferAttribute(opacities, 1);
    opacityAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("cloudOpacity", opacityAttribute);

    const material = new MeshLambertMaterial({
      map: texture,
      color: "#ffffff",
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        `attribute float cloudOpacity;
varying float vCloudOpacity;
` +
        shader.vertexShader.replace(
          "#include <fog_vertex>",
          `#include <fog_vertex>
vCloudOpacity = cloudOpacity;`,
        );

      let fragmentShader = shader.fragmentShader;
      fragmentShader =
        `varying float vCloudOpacity;
` + fragmentShader;

      if (fragmentShader.includes("#include <opaque_fragment>")) {
        fragmentShader = fragmentShader.replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
gl_FragColor = vec4( outgoingLight, diffuseColor.a * vCloudOpacity );`,
        );
      } else if (fragmentShader.includes("#include <output_fragment>")) {
        fragmentShader = fragmentShader.replace(
          "#include <output_fragment>",
          `#include <output_fragment>
gl_FragColor = vec4( outgoingLight, diffuseColor.a * vCloudOpacity );`,
        );
      }

      shader.fragmentShader = fragmentShader;
    };
    material.needsUpdate = true;

    const mesh = new InstancedMesh(geometry, material, CLOUD_SPRITE_LIMIT);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const colors = new Float32Array(CLOUD_SPRITE_LIMIT * 3);
    colors.fill(1);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.setUsage(DynamicDrawUsage);

    const instances: SpriteCloudInstance[] = [];
    const initialQuaternion = new Quaternion();
    const initialScale = new Vector3(1, 1, 1);
    const initialColor = new Color("#ffffff");

    for (let index = 0; index < CLOUD_SPRITE_LIMIT; index += 1) {
      const ringAngle = Math.random() * Math.PI * 2;
      const ringRadius = Math.sqrt(Math.random()) * CLOUD_LAYER_RADIUS;
      const driftAngle = Math.random() * Math.PI * 2;
      const cloud = {
        matrix: new Matrix4(),
        position: new Vector3(
          Math.cos(ringAngle) * ringRadius,
          CLOUD_ALTITUDE_MIN + Math.random() * CLOUD_ALTITUDE_VARIATION,
          Math.sin(ringAngle) * ringRadius,
        ),
        driftDirection: new Vector3(
          Math.cos(driftAngle),
          0,
          Math.sin(driftAngle),
        ),
        driftSpeed: this.randomRange(
          CLOUD_DRIFT_SPEED_MIN,
          CLOUD_DRIFT_SPEED_MAX,
        ),
        rotation: Math.random() * Math.PI * 2,
        rotationFactor: this.randomRange(
          CLOUD_ROTATION_FACTOR_MIN,
          CLOUD_ROTATION_FACTOR_MAX,
        ),
        volume: this.randomRange(CLOUD_VOLUME_MIN, CLOUD_VOLUME_MAX),
        growth: this.randomRange(CLOUD_GROWTH_MIN, CLOUD_GROWTH_MAX),
        density: this.randomRange(CLOUD_DENSITY_MIN, CLOUD_DENSITY_MAX),
        opacity: this.randomRange(CLOUD_OPACITY_MIN, CLOUD_OPACITY_MAX),
        brightness: this.randomRange(
          CLOUD_BRIGHTNESS_MIN,
          CLOUD_BRIGHTNESS_MAX,
        ),
        dist: 0,
      } satisfies SpriteCloudInstance;

      cloud.matrix.compose(cloud.position, initialQuaternion, initialScale);
      instances.push(cloud);
      opacities[index] = cloud.opacity;
      mesh.setMatrixAt(index, cloud.matrix);
      mesh.setColorAt(index, initialColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    opacityAttribute.needsUpdate = true;

    return {
      mesh,
      material,
      texture,
      opacities,
      opacityAttribute,
      instances,
    };
  }

  private updateSpriteClouds(
    dt: number,
    camera: PerspectiveCamera,
    dayFactor: number,
    twilightFactor: number,
    nightFactor: number,
  ): void {
    const cloudLayer = this.spriteCloudLayer;
    const cloudMesh = cloudLayer.mesh;

    cloudMesh.position.copy(this.lightAnchor);
    cloudMesh.updateMatrixWorld();

    this.cloudColor.lerpColors(
      this.cloudDayColor,
      this.cloudNightColor,
      nightFactor,
    );
    this.cloudColor.lerp(this.cloudTwilightColor, twilightFactor * 0.5);

    this.cloudBillboardQuaternion.copy(camera.quaternion);

    for (let index = 0; index < cloudLayer.instances.length; index += 1) {
      const cloud = cloudLayer.instances[index];
      cloud.rotation += dt * cloud.rotationFactor;
      cloud.position.addScaledVector(
        cloud.driftDirection,
        cloud.driftSpeed * dt,
      );

      const horizontalDistance = Math.hypot(cloud.position.x, cloud.position.z);
      if (horizontalDistance > CLOUD_WRAP_RADIUS) {
        const wrapAngle =
          Math.atan2(cloud.position.z, cloud.position.x) + Math.PI;
        const wrappedRadius = this.randomRange(
          CLOUD_LAYER_RADIUS * 0.58,
          CLOUD_LAYER_RADIUS * 0.95,
        );
        cloud.position.set(
          Math.cos(wrapAngle) * wrappedRadius,
          CLOUD_ALTITUDE_MIN + Math.random() * CLOUD_ALTITUDE_VARIATION,
          Math.sin(wrapAngle) * wrappedRadius,
        );
      }

      const cloudVolume =
        cloud.volume +
        (1 + Math.sin(this.elapsedSeconds * cloud.density)) *
          0.5 *
          cloud.growth;
      this.cloudScale.setScalar(cloudVolume);
      this.cloudSpinQuaternion
        .setFromAxisAngle(this.cloudForward, cloud.rotation)
        .premultiply(this.cloudBillboardQuaternion);
      cloud.matrix.compose(
        cloud.position,
        this.cloudSpinQuaternion,
        this.cloudScale,
      );
      cloud.dist = cloud.position.length();
    }

    cloudLayer.instances.sort((a, b) => b.dist - a.dist);
    const dayVisibility = MathUtils.lerp(0.48, 0.92, dayFactor);
    const nightVisibility = MathUtils.lerp(1, 0.62, nightFactor);

    for (let index = 0; index < cloudLayer.instances.length; index += 1) {
      const cloud = cloudLayer.instances[index];
      const edgeFade =
        1 -
        MathUtils.smoothstep(
          CLOUD_FADE_RADIUS * 0.72,
          CLOUD_FADE_RADIUS,
          cloud.dist,
        );
      cloudLayer.opacities[index] =
        cloud.opacity * edgeFade * dayVisibility * nightVisibility;
      cloudMesh.setMatrixAt(index, cloud.matrix);
      this.cloudInstanceColor
        .copy(this.cloudColor)
        .multiplyScalar(cloud.brightness + twilightFactor * 0.06);
      cloudMesh.setColorAt(index, this.cloudInstanceColor);
    }

    cloudLayer.opacityAttribute.needsUpdate = true;
    cloudMesh.instanceMatrix.needsUpdate = true;
    if (cloudMesh.instanceColor) {
      cloudMesh.instanceColor.needsUpdate = true;
    }
  }

  private randomRange(min: number, max: number): number {
    return min + (max - min) * Math.random();
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
    const shadowCamera = this.sunLight.shadow.camera as OrthographicCamera;
    shadowCamera.left = -halfExtent;
    shadowCamera.right = halfExtent;
    shadowCamera.top = halfExtent;
    shadowCamera.bottom = -halfExtent;
    shadowCamera.far = far;
    shadowCamera.updateProjectionMatrix();
  }

  private createStarField(): Points {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const twinkles = new Float32Array(STAR_COUNT * 2);
    const starColor = new Color();
    const starPosition = new Vector3();
    const spherical = new Spherical();
    let radius = STAR_RADIUS + STAR_DEPTH;
    const increment = STAR_DEPTH / STAR_COUNT;

    for (let i = 0; i < STAR_COUNT; i += 1) {
      radius -= increment * Math.random();
      spherical.set(
        radius,
        Math.acos(1 - Math.random() * 2),
        Math.random() * Math.PI * 2,
      );
      starPosition.setFromSpherical(spherical);
      positions[i * 3] = starPosition.x;
      positions[i * 3 + 1] = starPosition.y;
      positions[i * 3 + 2] = starPosition.z;

      starColor.setHSL(i / STAR_COUNT, STAR_SATURATION, 0.9);
      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;

      sizes[i] = (0.5 + 0.5 * Math.random()) * STAR_SIZE_FACTOR;
      twinkles[i * 2] = Math.random() * Math.PI * 2;
      twinkles[i * 2 + 1] = MathUtils.lerp(
        STAR_TWINKLE_RATE_MIN,
        STAR_TWINKLE_RATE_MAX,
        Math.random(),
      );
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("size", new BufferAttribute(sizes, 1));
    geometry.setAttribute("twinkle", new BufferAttribute(twinkles, 2));

    const material = new StarfieldMaterial(STAR_SOFT_FADE);
    material.uniforms.alpha.value = 0;

    const stars = new Points(geometry, material);
    stars.frustumCulled = false;
    return stars;
  }
}
