import { MathUtils, Vector3, ShaderMaterial } from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import {
  skyCloudColorReplace,
  skyNoiseFunctions,
  skyUniformsHeader,
} from "./shaders/dayNightSkyShader";
import type { CONFIG } from "../../game/Config";

export type SkyUniforms = {
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

export class SkyMesh {
  public readonly mesh: Sky;
  private readonly skyMaterial: ShaderMaterial;
  private readonly skyUniforms: SkyUniforms;
  private readonly uniformSunPosition = new Vector3();

  constructor(private readonly config: typeof CONFIG) {
    this.mesh = new Sky();
    this.mesh.scale.setScalar(this.config.sky.domeScale);
    this.mesh.frustumCulled = false;
    this.skyMaterial = this.mesh.material as ShaderMaterial;
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
  }

  update(
    lightAnchor: Vector3,
    sunDirection: Vector3,
    deepNightFactor: number,
    nightFactor: number,
    twilightFactor: number,
    dayFactor: number,
    elapsedSeconds: number,
  ): void {
    this.mesh.position.copy(lightAnchor);

    this.uniformSunPosition
      .copy(sunDirection)
      .multiplyScalar(this.config.sky.sun.visualDistance);
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

    const { cloud } = this.config.sky;
    this.skyUniforms.cloudCoverage.value = MathUtils.lerp(
      cloud.skyCoverageDay,
      cloud.skyCoverageTwilight,
      twilightFactor,
    );
    this.skyUniforms.cloudDensity.value = MathUtils.lerp(
      cloud.skyDensityDay,
      cloud.skyDensityTwilight,
      twilightFactor,
    );
    this.skyUniforms.cloudElevation.value = MathUtils.lerp(
      cloud.skyElevationNight,
      cloud.skyElevationDay,
      dayFactor,
    );
    this.skyUniforms.cloudNightFactor.value = MathUtils.smoothstep(
      nightFactor,
      0.22,
      0.86,
    );
    this.skyUniforms.time.value = elapsedSeconds * cloud.skyTimeScale;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.skyMaterial.dispose();
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
      skyUniformsHeader(),
    );

    fragmentShader = fragmentShader.replace(
      "void main() {",
      skyNoiseFunctions(),
    );

    fragmentShader = fragmentShader.replace(
      "vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );",
      skyCloudColorReplace(),
    );

    this.skyMaterial.fragmentShader = fragmentShader;
    this.skyMaterial.needsUpdate = true;
  }
}
