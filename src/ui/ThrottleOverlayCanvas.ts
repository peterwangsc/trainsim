import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type Material,
} from "three";
import { clamp, lerp } from "../util/Math";

const OVERLAY_WIDTH_RATIO = 0.22;
const OVERLAY_WIDTH_RATIO_COMPACT = 0.19;
const OVERLAY_MIN_WIDTH = 250;
const OVERLAY_MIN_WIDTH_COMPACT = 188;
const OVERLAY_MAX_WIDTH = 300;
const OVERLAY_MAX_WIDTH_COMPACT = 256;
const OVERLAY_ASPECT = 0.72;
const OVERLAY_MAX_HEIGHT_RATIO = 0.35;
const OVERLAY_MAX_HEIGHT_RATIO_COMPACT = 0.27;
const OVERLAY_MIN_RENDER_WIDTH = 80;
const COMPACT_UI_BREAKPOINT = 1023;
const OVERLAY_BOTTOM_MARGIN = 10;
const OVERLAY_BOTTOM_MARGIN_COMPACT = 8;
const OVERLAY_LEFT_MARGIN = 10;
const OVERLAY_LEFT_MARGIN_COMPACT = 8;
const LEVER_IDLE_ANGLE = 34;
const LEVER_MAX_ANGLE = -24;
const STEM_LENGTH = 0.45;
const STEM_RADIUS_TOP = 0.025;
const STEM_RADIUS_BOTTOM = 0.027;
const HANDLE_LENGTH = 0.34;
const HANDLE_RADIUS = 0.05;

const toRadians = (value: number): number => (value * Math.PI) / 180;

/**
 * Dedicated transparent renderer for the throttle control.
 * This keeps interaction isolated from the main scene canvas.
 */
export class ThrottleOverlayCanvas {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.1, 10);
  private readonly leverRoot = new Group();
  private readonly harness = new Group();
  private readonly handleHitTarget: Mesh;
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly ownedMeshes: Mesh[] = [];
  private activePointerId: number | null = null;
  private dragStartClientY = 0;
  private dragStartThrottle = 0;
  private throttle = 0;
  private isPointerHoveringHandle = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly onThrottleChange: (value: number) => void,
  ) {
    this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.domElement.className = "throttle-overlay-canvas";
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.left = `max(${OVERLAY_LEFT_MARGIN}px, env(safe-area-inset-left))`;
    this.renderer.domElement.style.bottom = `max(${OVERLAY_BOTTOM_MARGIN}px, env(safe-area-inset-bottom))`;
    this.renderer.domElement.style.zIndex = "4";
    this.renderer.domElement.style.touchAction = "none";

    this.handleHitTarget = this.buildLever();
    this.setupLighting();
    this.setupCamera();

    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.renderer.domElement.addEventListener(
      "pointermove",
      this.onPointerMove,
    );
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.onPointerLeave,
    );
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener(
      "pointercancel",
      this.onPointerUp,
    );
    window.addEventListener("blur", this.onWindowBlur);
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.onPointerMove,
    );
    this.renderer.domElement.removeEventListener(
      "pointerleave",
      this.onPointerLeave,
    );
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener(
      "pointercancel",
      this.onPointerUp,
    );
    window.removeEventListener("blur", this.onWindowBlur);
    this.releasePointer();

    for (const mesh of this.ownedMeshes) {
      mesh.geometry.dispose();
      this.disposeMaterial(mesh.material);
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  onResize(viewportWidth: number, viewportHeight: number): void {
    const isCompactUi = viewportWidth <= COMPACT_UI_BREAKPOINT;
    const widthRatio = isCompactUi
      ? OVERLAY_WIDTH_RATIO_COMPACT
      : OVERLAY_WIDTH_RATIO;
    const minWidth = isCompactUi
      ? OVERLAY_MIN_WIDTH_COMPACT
      : OVERLAY_MIN_WIDTH;
    const maxWidth = isCompactUi
      ? OVERLAY_MAX_WIDTH_COMPACT
      : OVERLAY_MAX_WIDTH;
    const maxHeightRatio = isCompactUi
      ? OVERLAY_MAX_HEIGHT_RATIO_COMPACT
      : OVERLAY_MAX_HEIGHT_RATIO;
    const targetWidth = clamp(viewportWidth * widthRatio, minWidth, maxWidth);
    const maxHeight = Math.max(
      120,
      Math.round(viewportHeight * maxHeightRatio),
    );
    const widthFromHeight = Math.max(
      OVERLAY_MIN_RENDER_WIDTH,
      Math.round(maxHeight * OVERLAY_ASPECT),
    );
    const width = Math.round(Math.min(targetWidth, widthFromHeight));
    const height = Math.round(width / OVERLAY_ASPECT);
    const leftMargin = isCompactUi
      ? OVERLAY_LEFT_MARGIN_COMPACT
      : OVERLAY_LEFT_MARGIN;
    const bottomMargin = isCompactUi
      ? OVERLAY_BOTTOM_MARGIN_COMPACT
      : OVERLAY_BOTTOM_MARGIN;

    this.renderer.domElement.style.left = `max(${leftMargin}px, env(safe-area-inset-left))`;
    this.renderer.domElement.style.bottom = `max(${bottomMargin}px, env(safe-area-inset-bottom))`;

    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;
    this.renderer.setSize(width, height, false);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(throttle: number): void {
    this.throttle = clamp(throttle, 0, 1);
    const angle = lerp(LEVER_IDLE_ANGLE, LEVER_MAX_ANGLE, this.throttle);
    this.harness.rotation.x = toRadians(60 + angle);
    this.render();
  }

  reset(): void {
    this.throttle = 0;
    this.update(0);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private buildLever(): Mesh {
    const panelMaterial = this.makeMaterial(0x212a37, 0.76, 0.2, 0x121822);
    const trackMaterial = this.makeMaterial(0x283243, 0.68, 0.26, 0x141b27);
    const stemMaterial = this.makeMaterial(0xb8c8da, 0.26, 0.72, 0x2a3646);
    const handleMaterial = this.makeMaterial(0xdbe5ef, 0.24, 0.78, 0x3b4b60);
    const harnessMaterial = this.makeMaterial(0x212a37, 0.25, 0.87, 0x121822);

    const panel = this.createMesh(
      new BoxGeometry(0.7, 0.94, 0.08),
      harnessMaterial,
    );
    this.leverRoot.add(panel);

    const slot = this.createMesh(
      new BoxGeometry(0.12, 0.62, 0.05),
      trackMaterial,
    );
    slot.position.set(0, 0.07, 0.06);
    this.leverRoot.add(slot);

    const pivot = this.createMesh(
      new CylinderGeometry(0.08, 0.08, 0.06, 24),
      stemMaterial,
    );
    pivot.rotation.x = Math.PI * 0.5;
    pivot.position.set(0, -0.04, -0.03);
    this.leverRoot.add(pivot);

    this.harness.position.copy(pivot.position);
    this.leverRoot.add(this.harness);

    const stem = this.createMesh(
      new CylinderGeometry(
        STEM_RADIUS_TOP,
        STEM_RADIUS_BOTTOM,
        STEM_LENGTH,
        18,
      ),
      stemMaterial,
    );
    stem.position.set(0, STEM_LENGTH * 0.5, 0);
    this.harness.add(stem);

    const handle = this.createMesh(
      new CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 20),
      handleMaterial,
    );
    handle.rotation.z = Math.PI * 0.5;
    handle.position.set(0, STEM_LENGTH, 0);
    this.harness.add(handle);

    const hitMaterial = this.makeMaterial(0xffffff, 1, 0, 0x000000);
    hitMaterial.transparent = true;
    hitMaterial.opacity = 0;

    const hitTarget = this.createMesh(
      new SphereGeometry(0.2, 16, 16),
      hitMaterial,
    );
    hitTarget.position.copy(handle.position);
    this.harness.add(hitTarget);

    this.leverRoot.rotation.y = toRadians(5);
    this.leverRoot.rotation.x = toRadians(-5);
    this.scene.add(this.leverRoot);
    return hitTarget;
  }

  private setupLighting(): void {
    const ambient = new AmbientLight(0xffffff, 3.9);
    const keyLight = new DirectionalLight(0xf0f5fc, 3.95);
    keyLight.position.set(0.9, 1.2, 2.0);

    this.scene.add(ambient, keyLight);
  }

  private setupCamera(): void {
    this.camera.position.set(0, 0.05, 1.9);
    this.camera.lookAt(0, 0.03, 0);
    this.camera.updateProjectionMatrix();
  }

  private createMesh(
    geometry: BoxGeometry | CylinderGeometry | SphereGeometry,
    material: MeshStandardMaterial,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    this.ownedMeshes.push(mesh);
    return mesh;
  }

  private makeMaterial(
    color: number,
    roughness: number,
    metalness: number,
    emissive: number,
  ): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity: 0.2,
    });
  }

  private disposeMaterial(material: Material | Material[]): void {
    if (Array.isArray(material)) {
      for (const item of material) {
        item.dispose();
      }
      return;
    }

    material.dispose();
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (!this.hitTestHandle(event.clientX, event.clientY)) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.dragStartClientY = event.clientY;
    this.dragStartThrottle = this.throttle;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.isPointerHoveringHandle = true;
    this.setCursor("grabbing");
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.activePointerId === null) {
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        this.updateHoverCursor(event.clientX, event.clientY);
      }
      return;
    }

    if (event.pointerId !== this.activePointerId) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const dragRange = clamp(rect.height * 0.72, 90, 220);
    const delta = (this.dragStartClientY - event.clientY) / dragRange;
    const nextThrottle = clamp(this.dragStartThrottle + delta, 0, 1);

    this.onThrottleChange(nextThrottle);
    this.update(nextThrottle);
    this.setCursor("grabbing");
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.releasePointer();
    this.updateHoverCursor(event.clientX, event.clientY);
    event.preventDefault();
  };

  private onPointerLeave = (): void => {
    if (this.activePointerId !== null) {
      return;
    }

    this.isPointerHoveringHandle = false;
    this.setCursor("default");
  };

  private onWindowBlur = (): void => {
    this.releasePointer();
    this.isPointerHoveringHandle = false;
    this.setCursor("default");
  };

  private releasePointer(): void {
    if (this.activePointerId === null) {
      return;
    }

    if (this.renderer.domElement.hasPointerCapture(this.activePointerId)) {
      this.renderer.domElement.releasePointerCapture(this.activePointerId);
    }

    this.activePointerId = null;
  }

  private updateHoverCursor(clientX: number, clientY: number): void {
    const hoveringHandle = this.hitTestHandle(clientX, clientY);
    if (hoveringHandle === this.isPointerHoveringHandle) {
      return;
    }

    this.isPointerHoveringHandle = hoveringHandle;
    this.setCursor(hoveringHandle ? "grab" : "default");
  }

  private setCursor(cursor: "default" | "pointer" | "grab" | "grabbing"): void {
    this.renderer.domElement.style.cursor = cursor;
  }

  private hitTestHandle(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return (
      this.raycaster.intersectObject(this.handleHitTarget, false).length > 0
    );
  }
}
