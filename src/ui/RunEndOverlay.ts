import { ASSETS_CDN_BASE } from "../game/Config";

export type RunEndTone = "won" | "failed";

export type RunEndOverlayOptions = {
  tone: RunEndTone;
  title: string;
  message: string;
  onRestart: () => void;
  onNextLevel?: () => void;
  onLogin?: (username: string) => void;
  username?: string | null;
};

export class RunEndOverlay {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly message: HTMLParagraphElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly authSection: HTMLDivElement;
  private readonly loginInput: HTMLInputElement;
  private readonly loginButton: HTMLButtonElement;

  private restartHandler: (() => void) | null = null;
  private nextLevelHandler: (() => void) | null = null;
  private loginHandler: ((username: string) => void) | null = null;
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

    this.authSection = document.createElement("div");
    this.authSection.className = "run-end-overlay__auth";
    this.authSection.style.marginTop = "20px";
    this.authSection.style.display = "none";
    this.authSection.style.flexDirection = "column";
    this.authSection.style.gap = "8px";

    this.loginInput = document.createElement("input");
    this.loginInput.type = "text";
    this.loginInput.placeholder = "Username or PIN";
    this.loginInput.style.padding = "8px";
    this.loginInput.style.borderRadius = "4px";
    this.loginInput.style.border = "1px solid #ccc";
    this.loginInput.style.textAlign = "center";

    this.loginButton = document.createElement("button");
    this.loginButton.type = "button";
    this.loginButton.textContent = "Log In to Save Progress";
    this.loginButton.style.padding = "8px";
    this.loginButton.style.borderRadius = "4px";
    this.loginButton.style.cursor = "pointer";
    this.loginButton.addEventListener("click", this.onLoginClick);

    this.authSection.append(this.loginInput, this.loginButton);

    card.append(
      logo,
      this.title,
      this.message,
      this.restartButton,
      this.authSection,
    );
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  show(options: RunEndOverlayOptions): void {
    this.restartHandler = options.onRestart;
    this.nextLevelHandler = options.onNextLevel ?? null;
    this.loginHandler = options.onLogin ?? null;

    this.title.textContent = options.title;
    this.message.textContent = options.message;
    this.root.classList.toggle("is-won", options.tone === "won");
    this.root.classList.toggle("is-failed", options.tone === "failed");

    if (options.tone === "won" && this.nextLevelHandler) {
      this.restartButton.textContent = "Next Level";
    } else {
      this.restartButton.textContent = "Restart";
    }

    if (!options.username) {
      this.loginInput.style.display = "block";
      this.loginButton.style.display = "block";
      this.loginInput.value = "";
      this.authSection.style.display = "flex";
    }

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
    this.loginButton.removeEventListener("click", this.onLoginClick);
    this.restartHandler = null;
    this.nextLevelHandler = null;
    this.loginHandler = null;
    this.root.remove();
  }

  reset(): void {
    this.root.classList.remove("run-end-overlay--visible");
    this.root.classList.add("run-end-overlay--hidden");
    this.title.textContent = "";
    this.message.textContent = "";
  }

  private onRestartClick = (): void => {
    if (
      this.restartButton.textContent === "Next Level" &&
      this.nextLevelHandler
    ) {
      this.nextLevelHandler();
    } else {
      this.restartHandler?.();
    }
  };

  private onLoginClick = (): void => {
    const username = this.loginInput.value.trim();
    if (username && this.loginHandler) {
      this.loginButton.textContent = "Logging in...";
      this.loginButton.disabled = true;
      this.loginHandler(username);
    }
  };
}
