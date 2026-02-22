const SPLASH_FADE_DURATION_MS = 8_000;

export class MouseLockSplash {
  private readonly root: HTMLDivElement;
  private fadeStartFrameId: number | null = null;
  private dismissTimeoutId: number | null = null;
  private dismissed = false;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "mouse-lock-splash";
    this.root.setAttribute("aria-hidden", "true");

    const logo = document.createElement("img");
    logo.className = "mouse-lock-splash__logo";
    logo.src = "/og.png";
    logo.alt = "TrainSim";
    logo.decoding = "async";
    logo.loading = "eager";

    this.root.appendChild(logo);
    container.appendChild(this.root);

    this.fadeStartFrameId = window.requestAnimationFrame(() => {
      this.fadeStartFrameId = null;
      this.root.classList.add("mouse-lock-splash--fading");
      this.dismissTimeoutId = window.setTimeout(
        this.dismiss,
        SPLASH_FADE_DURATION_MS,
      );
    });
  }

  dispose(): void {
    if (this.fadeStartFrameId !== null) {
      window.cancelAnimationFrame(this.fadeStartFrameId);
      this.fadeStartFrameId = null;
    }

    if (this.dismissTimeoutId !== null) {
      window.clearTimeout(this.dismissTimeoutId);
      this.dismissTimeoutId = null;
    }

    this.dismiss();
  }

  private dismiss = (): void => {
    if (this.dismissed) {
      return;
    }

    this.dismissed = true;
    this.root.classList.add("mouse-lock-splash--hidden");
    this.root.remove();
  };
}
