import { ASSETS_CDN_BASE } from "../game/Config";
import { TrackTimeRecord } from "../util/Supabase";

export type RunEndTone = "won" | "failed";

export type RunEndOverlayOptions = {
  tone: RunEndTone;
  title: string;
  message: string;
  timeMs?: number;
  recordHolder?: TrackTimeRecord | null;
  personalBestMs?: number | null;
  onRestart: () => void;
  onNextLevel?: () => void;
  onLogin?: (username: string) => void;
  username?: string | null;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const minStr = minutes > 0 ? `${minutes}:` : "";
  const secStr =
    minutes > 0 ? seconds.toString().padStart(2, "0") : seconds.toString();
  const msStr = milliseconds.toString().padStart(3, "0");

  return `${minStr}${secStr}.${msStr}`;
}

export class RunEndOverlay {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly message: HTMLParagraphElement;

  private readonly statsSection: HTMLDivElement;
  private readonly timeElement: HTMLDivElement;
  private readonly pbElement: HTMLDivElement;
  private readonly recordElement: HTMLDivElement;

  private readonly restartButton: HTMLButtonElement;
  private readonly authSection: HTMLDivElement;
  private readonly loginInput: HTMLInputElement;
  private readonly loginButton: HTMLButtonElement;

  private restartHandler: (() => void) | null = null;
  private nextLevelHandler: (() => void) | null = null;
  private loginHandler: ((username: string) => void) | null = null;
  private revealFrameId: number | null = null;
  private currentUsername: string | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "run-end-overlay run-end-overlay--hidden";

    const card = document.createElement("div");
    card.className = "run-end-overlay__card";

    this.title = document.createElement("h2");
    this.title.className = "run-end-overlay__title";

    this.message = document.createElement("p");
    this.message.className = "run-end-overlay__message";

    this.statsSection = document.createElement("div");
    this.statsSection.className = "run-end-overlay__stats";
    this.statsSection.style.display = "none";
    this.statsSection.style.flexDirection = "column";
    this.statsSection.style.gap = "8px";
    this.statsSection.style.marginTop = "16px";
    this.statsSection.style.marginBottom = "16px";
    this.statsSection.style.padding = "16px";
    this.statsSection.style.background = "rgba(0, 0, 0, 0.4)";
    this.statsSection.style.borderRadius = "8px";
    this.statsSection.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    this.statsSection.style.width = "100%";

    this.timeElement = document.createElement("div");
    this.timeElement.style.display = "flex";
    this.timeElement.style.justifyContent = "space-between";
    this.timeElement.style.fontSize = "16px";
    this.timeElement.style.fontWeight = "bold";

    this.pbElement = document.createElement("div");
    this.pbElement.style.display = "flex";
    this.pbElement.style.justifyContent = "space-between";
    this.pbElement.style.fontSize = "14px";
    this.pbElement.style.color = "#aaa";

    this.recordElement = document.createElement("div");
    this.recordElement.style.display = "flex";
    this.recordElement.style.justifyContent = "space-between";
    this.recordElement.style.fontSize = "14px";
    this.recordElement.style.color = "#aaa";

    this.statsSection.append(
      this.timeElement,
      this.pbElement,
      this.recordElement,
    );

    this.restartButton = document.createElement("button");
    this.restartButton.type = "button";
    this.restartButton.className = "run-end-overlay__restart";
    this.restartButton.textContent = "Restart";
    this.restartButton.addEventListener("click", () =>
      this.handleRestartClick(),
    );

    this.authSection = document.createElement("div");
    this.authSection.className = "login-screen__login-field";
    this.authSection.style.marginTop = "20px";
    this.authSection.style.display = "none";

    this.loginInput = document.createElement("input");
    this.loginInput.type = "text";
    this.loginInput.placeholder = "Username (Optional)";
    this.loginInput.className = "login-screen__username-input";
    this.loginInput.addEventListener("input", () =>
      this.updateLoginButtonState(),
    );

    this.loginButton = document.createElement("button");
    this.loginButton.type = "button";
    this.loginButton.textContent = "Log In to Save Progress";
    this.loginButton.className =
      "login-screen__login-button login-screen__login-button--disabled";
    this.loginButton.addEventListener("click", () => this.handleLoginClick());

    this.authSection.append(this.loginInput, this.loginButton);

    card.append(
      this.title,
      this.message,
      this.statsSection,
      this.restartButton,
      this.authSection,
    );
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  public show(options: RunEndOverlayOptions): void {
    this.restartHandler = options.onRestart;
    this.nextLevelHandler = options.onNextLevel ?? null;
    this.loginHandler = options.onLogin ?? null;
    this.currentUsername = options.username ?? null;

    this.title.textContent = options.title;
    this.message.textContent = options.message;
    this.root.classList.toggle("is-won", options.tone === "won");
    this.root.classList.toggle("is-failed", options.tone === "failed");

    this.statsSection.style.display = "flex";

    if (options.tone === "won" && options.timeMs !== undefined) {
      this.timeElement.style.display = "flex";
      this.timeElement.innerHTML = `
        <span>Your Time:</span>
        <span style="color: #4ade80">${formatTime(options.timeMs)}</span>
      `;
    } else {
      this.timeElement.style.display = "none";
    }

    if (options.personalBestMs !== undefined) {
      if (options.personalBestMs !== null) {
        this.pbElement.innerHTML = `
          <span>Personal Best:</span>
          <span style="color: #60a5fa">${formatTime(options.personalBestMs)}</span>
        `;
      } else {
        this.pbElement.innerHTML = `
          <span>Personal Best:</span>
          <span>N/A</span>
        `;
      }
    } else {
      this.pbElement.innerHTML = `
        <span>Personal Best:</span>
        <span>Loading...</span>
      `;
    }

    if (options.recordHolder) {
      const isYou = this.currentUsername && options.recordHolder.username === this.currentUsername;
      const holderDisplay = isYou ? "You" : options.recordHolder.username;
      this.recordElement.innerHTML = `
        <span>World Record by ${holderDisplay}:</span>
        <span style="color: #fbbf24">${formatTime(options.recordHolder.timeMs)}</span>
      `;
    } else {
      this.recordElement.innerHTML = `
        <span>World Record:</span>
        <span>Loading...</span>
      `;
    }

    this.restartButton.textContent =
      options.tone === "won" && this.nextLevelHandler
        ? "Next Level"
        : "Restart";

    if (!options.username) {
      this.loginInput.style.display = "block";
      this.loginButton.style.display = "block";
      this.loginInput.value = "";
      this.authSection.style.display = "flex";
      this.authSection.style.flexDirection = "column";
      this.authSection.style.gap = "8px";
      this.updateLoginButtonState();
    } else {
      this.authSection.style.display = "none";
    }

    if (this.revealFrameId !== null) {
      window.cancelAnimationFrame(this.revealFrameId);
    }

    this.root.classList.remove(
      "run-end-overlay--visible",
      "run-end-overlay--hidden",
    );

    this.revealFrameId = window.requestAnimationFrame(() => {
      this.revealFrameId = null;
      this.root.classList.add("run-end-overlay--visible");
    });
  }

  public updateRecord(recordHolder: TrackTimeRecord | null): void {
    if (this.statsSection.style.display !== "none") {
      if (recordHolder) {
        const isYou = this.currentUsername && recordHolder.username === this.currentUsername;
        const holderDisplay = isYou ? "You" : recordHolder.username;
        this.recordElement.innerHTML = `
          <span>World Record by ${holderDisplay}:</span>
          <span style="color: #fbbf24">${formatTime(recordHolder.timeMs)}</span>
        `;
      } else {
        this.recordElement.innerHTML = `
          <span>World Record:</span>
          <span>N/A</span>
        `;
      }
    }
  }

  public updatePersonalBest(pbMs: number | null): void {
    if (this.statsSection.style.display !== "none") {
      if (pbMs !== null) {
        this.pbElement.innerHTML = `
          <span>Personal Best:</span>
          <span style="color: #60a5fa">${formatTime(pbMs)}</span>
        `;
      } else {
        this.pbElement.innerHTML = `
          <span>Personal Best:</span>
          <span>N/A</span>
        `;
      }
    }
  }

  public dispose(): void {
    if (this.revealFrameId !== null) {
      window.cancelAnimationFrame(this.revealFrameId);
      this.revealFrameId = null;
    }

    this.restartHandler = null;
    this.nextLevelHandler = null;
    this.loginHandler = null;
    this.root.remove();
  }

  public reset(): void {
    this.root.classList.remove("run-end-overlay--visible");
    this.root.classList.add("run-end-overlay--hidden");
    this.title.textContent = "";
    this.message.textContent = "";
    this.loginButton.textContent = "Log In to Save Progress";
    this.loginButton.disabled = false;
    this.statsSection.style.display = "none";
  }

  private handleRestartClick(): void {
    if (
      this.restartButton.textContent === "Next Level" &&
      this.nextLevelHandler
    ) {
      this.nextLevelHandler();
    } else {
      this.restartHandler?.();
    }
  }

  private handleLoginClick(): void {
    const username = this.loginInput.value.trim();
    if (username && this.loginHandler) {
      this.loginButton.textContent = "Logging in...";
      this.loginButton.disabled = true;
      this.loginButton.classList.add("login-screen__login-button--disabled");
      this.loginHandler(username);
    }
  }

  private updateLoginButtonState(): void {
    const username = this.loginInput.value.trim();
    const canLogin = username.length > 0;
    this.loginButton.classList.toggle(
      "login-screen__login-button--disabled",
      !canLogin,
    );
    this.loginButton.disabled = !canLogin;
  }
}
