import { ASSETS_CDN_BASE } from "../game/Config";

export type RunEndTone = "won" | "failed";

export type RunEndOverlayOptions = {
  tone: RunEndTone;
  title: string;
  message: string;
  onRestart: () => void;
};

export class RunEndOverlay {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly message: HTMLParagraphElement;
  private readonly restartButton: HTMLButtonElement;
  private restartHandler: (() => void) | null = null;
  private revealFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "run-end-overlay run-end-overlay--hidden";

    const card = document.createElement("div");
    card.className = "run-end-overlay__card";

    const logo = document.createElement("img");
    logo.className = "run-end-overlay__logo";
    logo.src = `${ASSETS_CDN_BASE}/og.png`;
    logo.alt = "TrainSim";
    logo.decoding = "async";

    this.title = document.createElement("h2");
    this.title.className = "run-end-overlay__title";

    this.message = document.createElement("p");
    this.message.className = "run-end-overlay__message";

    this.restartButton = document.createElement("button");
    this.restartButton.type = "button";
    this.restartButton.className = "run-end-overlay__restart";
    this.restartButton.textContent = "Restart";
    this.restartButton.addEventListener("click", this.onRestartClick);

    card.append(logo, this.title, this.message, this.restartButton);
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  show(options: RunEndOverlayOptions): void {
    this.restartHandler = options.onRestart;
    this.title.textContent = options.title;
    this.message.textContent = options.message;
    this.root.classList.toggle("is-won", options.tone === "won");
    this.root.classList.toggle("is-failed", options.tone === "failed");

    if (this.revealFrameId !== null) {
      window.cancelAnimationFrame(this.revealFrameId);
      this.revealFrameId = null;
    }

    this.root.classList.remove("run-end-overlay--visible");
    this.root.classList.remove("run-end-overlay--hidden");
    this.revealFrameId = window.requestAnimationFrame(() => {
      this.revealFrameId = null;
      this.root.classList.add("run-end-overlay--visible");
    });
  }

  dispose(): void {
    if (this.revealFrameId !== null) {
      window.cancelAnimationFrame(this.revealFrameId);
      this.revealFrameId = null;
    }

    this.restartButton.removeEventListener("click", this.onRestartClick);
    this.restartHandler = null;
    this.root.remove();
  }

  reset(): void {
    this.root.classList.remove("run-end-overlay--visible");
    this.root.classList.add("run-end-overlay--hidden");
    this.title.textContent = "";
    this.message.textContent = "";
  }

  private onRestartClick = (): void => {
    this.restartHandler?.();
  };
}
