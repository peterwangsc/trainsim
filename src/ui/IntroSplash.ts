import { ASSETS_CDN_BASE } from "@/game/Config";

const SPLASH_FADE_DURATION_MS = 8_000;

export class IntroSplash {
  private readonly root: HTMLDivElement;
  private dismissTimeoutId: number | null = null;
  private dismissed = false;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "intro-splash";
    this.root.setAttribute("aria-hidden", "true");

    const logo = document.createElement("img");
    logo.className = "intro-splash__logo";
    logo.src = `${ASSETS_CDN_BASE}/og.png`;
    logo.alt = "TrainSim";
    logo.decoding = "async";
    logo.loading = "eager";

    this.root.appendChild(logo);
    container.appendChild(this.root);
  }

  public start(): void {
    this.root.classList.add("intro-splash--fading");
    this.dismissTimeoutId = window.setTimeout(
      () => this.dismiss(),
      SPLASH_FADE_DURATION_MS,
    );
  }

  public dispose(): void {
    if (this.dismissTimeoutId !== null) {
      window.clearTimeout(this.dismissTimeoutId);
      this.dismissTimeoutId = null;
    }

    this.dismiss();
  }

  private dismiss(): void {
    if (this.dismissed) {
      return;
    }

    this.dismissed = true;
    this.root.classList.add("intro-splash--hidden");
    this.root.remove();
  }
}
