import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from "three";

export class Renderer {
  private readonly renderer: WebGLRenderer;

  constructor(private readonly container: HTMLElement) {
    const isMobile =
      navigator.maxTouchPoints > 0 ||
      (window.innerWidth < 650 && window.innerHeight > window.innerWidth);

    this.renderer = new WebGLRenderer({ antialias: !isMobile });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  compile(scene: Scene, camera: PerspectiveCamera): void {
    this.renderer.compile(scene, camera);
  }

  render(scene: Scene, camera: PerspectiveCamera): void {
    this.renderer.render(scene, camera);
  }

  setToneMappingExposure(exposure: number): void {
    this.renderer.toneMappingExposure = exposure;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
