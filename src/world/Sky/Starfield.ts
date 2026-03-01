import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
  Points,
  REVISION,
  ShaderMaterial,
  Spherical,
  Vector3,
} from "three";
import {
  starfieldFragment,
  starfieldVertex,
} from "@/world/Sky/shaders/dayNightSkyShader";
import type { CONFIG } from "@/game/Config";

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
      vertexShader: starfieldVertex(),
      fragmentShader: starfieldFragment(colorSpaceInclude),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
      fog: false,
    });
  }
}

export class Starfield {
  public readonly mesh: Points;
  private readonly material: StarfieldMaterial;

  constructor(private readonly config: typeof CONFIG) {
    const { count, radius, depth, saturation, sizeFactor, twinkleRateMin, twinkleRateMax, softFade } = this.config.sky.star;
    
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkles = new Float32Array(count * 2);
    
    const starColor = new Color();
    const starPosition = new Vector3();
    const spherical = new Spherical();
    
    let currentRadius = radius + depth;
    const increment = depth / count;

    for (let i = 0; i < count; i += 1) {
      currentRadius -= increment * Math.random();
      spherical.set(
        currentRadius,
        Math.acos(1 - Math.random() * 2),
        Math.random() * Math.PI * 2,
      );
      starPosition.setFromSpherical(spherical);
      positions[i * 3] = starPosition.x;
      positions[i * 3 + 1] = starPosition.y;
      positions[i * 3 + 2] = starPosition.z;

      starColor.setHSL(i / count, saturation, 0.9);
      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;

      sizes[i] = (0.5 + 0.5 * Math.random()) * sizeFactor;
      twinkles[i * 2] = Math.random() * Math.PI * 2;
      twinkles[i * 2 + 1] = MathUtils.lerp(twinkleRateMin, twinkleRateMax, Math.random());
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("size", new BufferAttribute(sizes, 1));
    geometry.setAttribute("twinkle", new BufferAttribute(twinkles, 2));

    this.material = new StarfieldMaterial(softFade);
    this.material.uniforms.alpha.value = 0;

    this.mesh = new Points(geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  update(lightAnchor: Vector3, elapsedSeconds: number, nightFactor: number): void {
    this.mesh.position.copy(lightAnchor);
    this.material.uniforms.time.value = elapsedSeconds * this.config.sky.star.twinkleSpeed;
    this.mesh.visible = nightFactor > 0.01;
    this.material.uniforms.alpha.value = nightFactor * 0.95;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
