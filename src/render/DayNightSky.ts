import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

const DEFAULT_DAY_CYCLE_DURATION_SECONDS = 300;
const SUN_CYCLE_PHASE_OFFSET_RADIANS = Math.PI * 0.25;

const SKY_DOME_SCALE = 9500;
const STAR_FIELD_RADIUS = 2000;
const STAR_COUNT = 1300;

const SUN_ORBIT_RADIUS = 700;
const SUN_ORBIT_Z_OFFSET = 180;
const SUN_VISUAL_DISTANCE = 5600;
const MOON_VISUAL_DISTANCE = 5400;
const LIGHT_DISTANCE = 5000;

const DAY_FOG_NEAR = 45;
const DAY_FOG_FAR = 520;
const NIGHT_FOG_NEAR = 32;
const NIGHT_FOG_FAR = 200;

const MOON_HALO_BASE_SCALE = 1.4;
const MOON_HALO_PULSE_SCALE = 2.0;
const SKY_CLOUD_TIME_SCALE = 0.45;
const SKY_CLOUD_COVERAGE_DAY = 0.24;
const SKY_CLOUD_COVERAGE_TWILIGHT = 0.58;
const SKY_CLOUD_DENSITY_DAY = 0.28;
const SKY_CLOUD_DENSITY_TWILIGHT = 0.62;
const SKY_CLOUD_ELEVATION_DAY = 0.56;
const SKY_CLOUD_ELEVATION_NIGHT = 0.44;

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
  time: { value: number };
};

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
  private readonly moonLowColor = new Color("#92aad8");
  private readonly moonHighColor = new Color("#d4e1ff");

  private readonly dayCycleDurationSeconds: number;
  private readonly sky: Sky;
  private readonly skyMaterial: ShaderMaterial;
  private readonly skyUniforms: SkyUniforms;

  private readonly stars: Points;
  private readonly starsMaterial: PointsMaterial;

  private readonly sunMesh: Mesh;
  private readonly sunMaterial: MeshBasicMaterial;
  private readonly moonMesh: Mesh;
  private readonly moonMaterial: MeshBasicMaterial;
  private readonly moonHalo: Mesh;
  private readonly moonHaloMaterial: MeshBasicMaterial;

  private readonly sunTarget = new Object3D();
  private readonly moonTarget = new Object3D();

  private readonly lightAnchor = new Vector3();
  private readonly sunOffset = new Vector3();
  private readonly sunDirection = new Vector3();
  private readonly moonDirection = new Vector3();
  private readonly sunVisualPosition = new Vector3();
  private readonly moonVisualPosition = new Vector3();
  private readonly uniformSunPosition = new Vector3();
  private readonly sunLightColor = new Color();
  private readonly hemisphereSkyColor = new Color();
  private readonly hemisphereGroundColor = new Color();
  private readonly ambientColor = new Color();
  private readonly moonLightColor = new Color();

  private elapsedSeconds = 0;
  private nightFactor = 0;
  private recommendedExposure = EXPOSURE_DAY;

  constructor(
    private readonly scene: Scene,
    options: DayNightSkyOptions = {},
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
    this.skyUniforms.time.value = 0;
    this.scene.add(this.sky);

    this.stars = this.createStarField();
    this.starsMaterial = this.stars.material as PointsMaterial;
    this.scene.add(this.stars);

    this.sunMaterial = new MeshBasicMaterial({
      color: "#ffe2a7",
      transparent: true,
      opacity: 1,
      toneMapped: false,
      fog: false,
    });
    this.sunMesh = new Mesh(new SphereGeometry(78, 28, 28), this.sunMaterial);
    this.sunMesh.frustumCulled = false;
    this.scene.add(this.sunMesh);

    this.moonMaterial = new MeshBasicMaterial({
      color: "#f2f7ff",
      transparent: true,
      opacity: 0,
      toneMapped: false,
      fog: false,
    });
    this.moonMesh = new Mesh(new SphereGeometry(58, 28, 28), this.moonMaterial);
    this.moonMesh.frustumCulled = false;
    this.scene.add(this.moonMesh);

    this.moonHaloMaterial = new MeshBasicMaterial({
      color: "#a6c4ff",
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.moonHalo = new Mesh(
      new SphereGeometry(92, 24, 24),
      this.moonHaloMaterial,
    );
    this.moonHalo.frustumCulled = false;
    this.scene.add(this.moonHalo);

    this.sunLight = new DirectionalLight("#fff4d6", SUN_LIGHT_DAY_INTENSITY);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const sunShadowCamera = this.sunLight.shadow.camera as OrthographicCamera;
    sunShadowCamera.near = 0.5;
    sunShadowCamera.far = 900;
    sunShadowCamera.left = -80;
    sunShadowCamera.right = 80;
    sunShadowCamera.top = 80;
    sunShadowCamera.bottom = -80;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.03;
    this.sunLight.target = this.sunTarget;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunTarget);

    this.moonLight = new DirectionalLight("#b0c4de", MOON_LIGHT_MAX_INTENSITY);
    this.moonLight.castShadow = false;
    this.moonLight.shadow.mapSize.set(512, 512);
    const moonShadowCamera = this.moonLight.shadow.camera as OrthographicCamera;
    moonShadowCamera.near = 0.5;
    moonShadowCamera.far = 700;
    moonShadowCamera.left = -68;
    moonShadowCamera.right = 68;
    moonShadowCamera.top = 68;
    moonShadowCamera.bottom = -68;
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

    this.sunOffset.set(
      Math.cos(angle) * SUN_ORBIT_RADIUS,
      Math.sin(angle) * SUN_ORBIT_RADIUS,
      SUN_ORBIT_Z_OFFSET,
    );

    const sunHeight = this.sunOffset.y / SUN_ORBIT_RADIUS;
    const dayFactor = MathUtils.smoothstep(sunHeight, -0.08, 0.12);
    const nightFactor = 1 - MathUtils.smoothstep(sunHeight, -0.12, 0.08);
    this.nightFactor = nightFactor;
    const twilightFactor = 1 - Math.abs(dayFactor * 2 - 1);
    const deepNightFactor = MathUtils.smoothstep(nightFactor, 0.62, 1);
    const sunLightFactor = Math.pow(Math.max(0, dayFactor), 3.35);

    this.sunDirection.copy(this.sunOffset).normalize();
    this.moonDirection.copy(this.sunDirection).multiplyScalar(-1);

    this.uniformSunPosition
      .copy(this.sunDirection)
      .multiplyScalar(SUN_VISUAL_DISTANCE);
    this.skyUniforms.sunPosition.value.copy(this.uniformSunPosition);
    const deepNightScatteringDarken = MathUtils.lerp(1, 0.56, deepNightFactor);
    this.skyUniforms.turbidity.value =
      MathUtils.lerp(0.8, 9.4, nightFactor) *
      MathUtils.lerp(1, 0.88, deepNightFactor);
    this.skyUniforms.rayleigh.value =
      MathUtils.lerp(0.2, 0.06, nightFactor) * deepNightScatteringDarken;
    this.skyUniforms.mieCoefficient.value =
      MathUtils.lerp(0.0002, 0, nightFactor) * deepNightScatteringDarken;
    this.skyUniforms.mieDirectionalG.value = MathUtils.lerp(
      0.6,
      0.4,
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

    this.sunLight.position
      .copy(this.lightAnchor)
      .addScaledVector(this.sunDirection, LIGHT_DISTANCE);
    this.sunTarget.position.copy(this.lightAnchor);
    this.sunTarget.updateMatrixWorld();
    this.sunLight.intensity = SUN_LIGHT_DAY_INTENSITY * sunLightFactor;
    this.sunLight.castShadow = sunLightFactor > SUN_SHADOW_ENABLE_THRESHOLD;
    const sunElevationFactor = MathUtils.smoothstep(
      Math.max(0, sunHeight),
      0.02,
      0.68,
    );
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
      .addScaledVector(this.moonDirection, LIGHT_DISTANCE);
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

    this.sunVisualPosition
      .copy(this.lightAnchor)
      .addScaledVector(this.sunDirection, SUN_VISUAL_DISTANCE);
    this.sunMesh.position.copy(this.sunVisualPosition);
    this.sunMaterial.opacity = MathUtils.clamp((sunHeight + 0.18) / 0.58, 0, 1);

    this.moonVisualPosition
      .copy(this.lightAnchor)
      .addScaledVector(this.moonDirection, MOON_VISUAL_DISTANCE);
    this.moonMesh.position.copy(this.moonVisualPosition);
    this.moonMaterial.opacity = moonGlowFactor;

    this.moonHalo.position.copy(this.moonVisualPosition);
    const haloScale = MathUtils.lerp(
      MOON_HALO_BASE_SCALE,
      MOON_HALO_PULSE_SCALE,
      moonGlowFactor,
    );
    this.moonHalo.scale.setScalar(haloScale);
    this.moonHaloMaterial.opacity = 0.52 * moonGlowFactor;

    this.stars.visible = nightFactor > 0.01;
    this.starsMaterial.opacity = nightFactor * 0.95;

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
      this.sunMesh,
      this.moonMesh,
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
    this.sunMesh.geometry.dispose();
    this.sunMaterial.dispose();
    this.moonMesh.geometry.dispose();
    this.moonMaterial.dispose();
    this.moonHalo.geometry.dispose();
    this.moonHaloMaterial.dispose();
  }

  private ensureSkyCloudUniforms(): void {
    const uniforms = this.skyMaterial.uniforms as Record<
      string,
      { value: number | Vector3 }
    >;
    uniforms.cloudCoverage ??= { value: 0.4 };
    uniforms.cloudDensity ??= { value: 0.4 };
    uniforms.cloudElevation ??= { value: 0.5 };
    uniforms.time ??= { value: 0 };

    const hasCloudUniformsInShader =
      this.skyMaterial.fragmentShader.includes(
        "uniform float cloudCoverage;",
      ) &&
      this.skyMaterial.fragmentShader.includes("uniform float cloudDensity;") &&
      this.skyMaterial.fragmentShader.includes(
        "uniform float cloudElevation;",
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
			vec3 cloudTint = mix(
				vec3( 1.0 ),
				vec3( 1.25, 0.72, 0.42 ),
				clamp( 1.0 - direction.y * 1.4, 0.0, 1.0 )
			);
			texColor = mix( texColor, texColor * 0.6 + cloudTint * 0.08, cloudMask * cloudDensity );`,
    );

    this.skyMaterial.fragmentShader = fragmentShader;
    this.skyMaterial.needsUpdate = true;
  }

  private createStarField(): Points {
    const positions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const azimuth = Math.random() * Math.PI * 2;
      const y = MathUtils.lerp(-0.1, 1, Math.random());
      const ring = Math.sqrt(1 - y * y);
      const radius = STAR_FIELD_RADIUS * MathUtils.lerp(0.82, 1, Math.random());

      positions[i * 3] = Math.cos(azimuth) * ring * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(azimuth) * ring * radius;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color: "#f7f8ff",
      size: 1.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });

    const stars = new Points(geometry, material);
    stars.frustumCulled = false;
    return stars;
  }
}
