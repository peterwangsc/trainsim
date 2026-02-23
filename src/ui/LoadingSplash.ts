import { ASSETS_CDN_BASE } from "../game/Config";

export class LoadingSplash {
  private readonly root: HTMLDivElement;
  private readonly progressLabel: HTMLParagraphElement;
  private readonly progressTrack: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;
  private readonly cta: HTMLButtonElement;
  private readonly progressContainer: HTMLDivElement;
  private dismissed = false;
  private isReady = false;
  private isStarting = false;

  constructor(
    container: HTMLElement,
    private readonly onStart: () => Promise<void> | void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "loading-splash";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-live", "polite");

    const card = document.createElement("div");
    card.className = "loading-splash__card";

    const logo = document.createElement("img");
    logo.className = "loading-splash__logo";
    logo.src = `${ASSETS_CDN_BASE}/og.png`;
    logo.alt = "TrainSim";
    logo.decoding = "async";
    logo.loading = "eager";
    logo.draggable = false;

    const hint = document.createElement("p");
    hint.className = "loading-splash__hint";
    hint.innerHTML =
      "Navigate your train to the terminal station.<br/>Stop before the platform ends.";

    this.progressLabel = document.createElement("p");
    this.progressLabel.className = "loading-splash__progress-label";
    this.progressLabel.textContent = "Loading 0%";

    this.progressTrack = document.createElement("div");
    this.progressTrack.className = "loading-splash__progress-track";

    this.progressFill = document.createElement("div");
    this.progressFill.className = "loading-splash__progress-fill";
    this.progressTrack.appendChild(this.progressFill);

    this.cta = document.createElement("button");
    this.cta.className = "loading-splash__cta loading-splash__cta--hidden";
    this.cta.type = "button";
    this.cta.textContent = `Push to Start`;
    this.cta.addEventListener("click", this.onTap);

    this.progressContainer = document.createElement("div");
    this.progressContainer.className = "loading-splash__progress-container";
    this.progressContainer.appendChild(hint);

    const ctaContainer = document.createElement("div");
    ctaContainer.className = "loading-splash__cta-container";
    ctaContainer.appendChild(this.progressLabel);
    ctaContainer.appendChild(this.progressTrack);
    ctaContainer.appendChild(this.cta);
    this.progressContainer.appendChild(ctaContainer);

    card.append(logo, this.progressContainer);
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  setProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const pct = Math.round(clamped * 100);
    this.progressFill.style.width = `${pct}%`;
    if (!this.isReady) {
      this.progressLabel.textContent = `Loading ${pct}%`;
    }
  }

  async setReady(): Promise<void> {
    this.isReady = true;
    this.setProgress(1);
    this.progressLabel.style.display = "none";
    this.progressTrack.style.display = "none";
    this.cta.className = "loading-splash__cta";
  }

  setError(message: string): void {
    this.isReady = false;
    this.isStarting = false;
    this.progressLabel.textContent = message;
    this.cta.disabled = true;
    this.cta.textContent = "Unavailable";
  }

  private onTap = async (): Promise<void> => {
    if (!this.isReady || this.isStarting) {
      return;
    }

    this.isStarting = true;
    this.cta.disabled = true;
    this.cta.textContent = "Starting";
    this.root.classList.add("loading-splash--out");

    try {
      await this.onStart();
      this.dismiss();
    } catch (error) {
      this.root.classList.remove("loading-splash--out");
      console.error(error);
      this.isStarting = false;
      if (this.isReady) {
        this.cta.disabled = false;
        this.cta.textContent = "Error. Try again";
      }
    }
  };

  private dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    const remove = (): void => this.root.remove();
    const tid = window.setTimeout(remove, 4000);
    this.root.addEventListener(
      "transitionend",
      () => {
        clearTimeout(tid);
        remove();
      },
      { once: true },
    );
  }
}
