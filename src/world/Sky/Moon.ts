import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DirectionalLight,
  MathUtils,
  Object3D,
  OrthographicCamera,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { CONFIG } from "@/game/Config";

export class Moon {
  public readonly light: DirectionalLight;
  public readonly target: Object3D;
  public readonly sprite: Sprite;
  public readonly halo: Sprite;

  private readonly moonDiscTexture: CanvasTexture;
  private readonly moonGlowTexture: CanvasTexture;
  private readonly moonMaterial: SpriteMaterial;
  private readonly moonHaloMaterial: SpriteMaterial;

  private readonly moonLowColor = new Color("#9fb6de");
  private readonly moonHighColor = new Color("#e9f1ff");
  private readonly moonLightColor = new Color();
  private readonly moonVisualPosition = new Vector3();

  constructor(private readonly config: typeof CONFIG) {
    const { moon } = this.config.sky;

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
    this.sprite = new Sprite(this.moonMaterial);
    this.sprite.scale.set(moon.discSize, moon.discSize, 1);
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 11;

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
    this.halo = new Sprite(this.moonHaloMaterial);
    this.halo.scale.set(
      moon.discSize * moon.haloBaseScale,
      moon.discSize * moon.haloBaseScale,
      1,
    );
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 10;

    this.light = new DirectionalLight("#b0c4de", moon.lightMaxIntensity);
    this.light.castShadow = false;
    this.light.shadow.mapSize.set(512, 512);

    const moonShadowCamera = this.light.shadow.camera as OrthographicCamera;
    moonShadowCamera.near = 0.5;
    moonShadowCamera.far = 420;
    moonShadowCamera.left = -120;
    moonShadowCamera.right = 120;
    moonShadowCamera.top = 120;
    moonShadowCamera.bottom = -120;
    moonShadowCamera.updateProjectionMatrix();

    this.light.shadow.bias = -0.00025;
    this.light.shadow.normalBias = 0.025;
    this.target = new Object3D();
    this.light.target = this.target;
  }

  update(
    lightAnchor: Vector3,
    moonDirection: Vector3,
    moonGlowFactor: number,
    nightFactor: number,
    moonElevation: number,
    sunLightCastShadow: boolean,
  ): void {
    const { moon } = this.config.sky;

    this.light.position
      .copy(lightAnchor)
      .addScaledVector(moonDirection, moon.shadowLightDistance);
    this.target.position.copy(lightAnchor);
    this.target.updateMatrixWorld();

    this.light.intensity = moonGlowFactor * moon.lightMaxIntensity;
    this.light.castShadow =
      !sunLightCastShadow &&
      moonGlowFactor > moon.shadowEnableThreshold;

    this.moonLightColor.lerpColors(
      this.moonLowColor,
      this.moonHighColor,
      moonElevation,
    );
    this.light.color.copy(this.moonLightColor);

    this.moonVisualPosition
      .copy(lightAnchor)
      .addScaledVector(moonDirection, moon.visualDistance);
    this.sprite.position.copy(this.moonVisualPosition);
    this.moonMaterial.opacity = MathUtils.lerp(0.9, 0.96, nightFactor);

    this.halo.position.copy(this.moonVisualPosition);
    const haloScale = MathUtils.lerp(
      moon.haloBaseScale,
      moon.haloPulseScale,
      Math.sqrt(moonGlowFactor),
    );
    const haloSize = moon.discSize * haloScale;
    this.halo.scale.set(haloSize, haloSize, 1);
    this.moonHaloMaterial.opacity = Math.pow(moonGlowFactor, 0.85) * 0.88;
  }

  dispose(): void {
    this.light.dispose();
    this.moonMaterial.dispose();
    this.moonHaloMaterial.dispose();
    this.moonDiscTexture.dispose();
    this.moonGlowTexture.dispose();
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
}
