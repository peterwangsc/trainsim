import { RunEndOverlayComponent } from "@/ui/components/RunEndOverlay";
import { TrackTimeRecord } from "@/util/TrackTimes";

export type RunEndTone = "won" | "failed";

export type RunEndOverlayOptions = {
  tone: RunEndTone;
  title: string;
  message: string;
  timeMs?: number;
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

  private readonly handleRestartClickBound: () => void;
  private readonly handleLoginInputBound: () => void;
  private readonly handleLoginClickBound: () => void;

  private restartHandler: (() => void) | null = null;
  private nextLevelHandler: (() => void) | null = null;
  private loginHandler: ((username: string) => void) | null = null;
  private revealFrameId: number | null = null;
  private currentUsername: string | null = null;

  constructor(container: HTMLElement) {
    this.handleRestartClickBound = this.handleRestartClick.bind(this);
    this.handleLoginInputBound = this.updateLoginButtonState.bind(this);
    this.handleLoginClickBound = this.handleLoginClick.bind(this);

    this.root = RunEndOverlayComponent({
      onRestartClick: this.handleRestartClickBound,
      onLoginInput: this.handleLoginInputBound,
      onLoginClick: this.handleLoginClickBound,
    });

    this.title = this.root.querySelector("#run-end-overlay-title") as HTMLHeadingElement;
    this.message = this.root.querySelector("#run-end-overlay-message") as HTMLParagraphElement;
    this.statsSection = this.root.querySelector("#run-end-overlay-stats") as HTMLDivElement;
    this.timeElement = this.root.querySelector("#run-end-overlay-time") as HTMLDivElement;
    this.pbElement = this.root.querySelector("#run-end-overlay-pb") as HTMLDivElement;
    this.recordElement = this.root.querySelector("#run-end-overlay-record") as HTMLDivElement;
    this.restartButton = this.root.querySelector("#run-end-overlay-restart") as HTMLButtonElement;
    this.authSection = this.root.querySelector("#run-end-overlay-auth") as HTMLDivElement;
    this.loginInput = this.root.querySelector("#run-end-overlay-login-input") as HTMLInputElement;
    this.loginButton = this.root.querySelector("#run-end-overlay-login-button") as HTMLButtonElement;

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
    this.timeElement.style.display =
      options.tone === "won" && options.timeMs !== undefined ? "flex" : "none";
    if (options.timeMs !== undefined) {
      this.renderStatRow(
        this.timeElement,
        "Your Time:",
        formatTime(options.timeMs),
        "#4ade80",
      );
    }

    this.renderPb(undefined);
    this.renderRecord(undefined);

    this.restartButton.textContent =
      options.tone === "won" && this.nextLevelHandler
        ? "Next Level"
        : "Restart";

    if (!options.username) {
      this.loginInput.value = "";
      this.authSection.style.display = "flex";
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
      this.renderRecord(recordHolder);
    }
  }

  public updatePersonalBest(pbMs: number | null): void {
    if (this.statsSection.style.display !== "none") {
      this.renderPb(pbMs);
    }
  }

  private renderRecord(recordHolder: TrackTimeRecord | null | undefined): void {
    if (recordHolder === undefined) {
      this.renderStatRow(this.recordElement, "World Record:", "Loading...");
      return;
    }

    if (!recordHolder) {
      this.renderStatRow(this.recordElement, "World Record:", "N/A");
      return;
    }

    const holder =
      this.currentUsername && recordHolder.username === this.currentUsername
        ? "You"
        : recordHolder.username;

    this.renderStatRow(
      this.recordElement,
      `World Record by ${holder}:`,
      formatTime(recordHolder.timeMs),
      "#fbbf24",
    );
  }

  private renderPb(pbMs: number | null | undefined): void {
    if (pbMs === undefined) {
      this.renderStatRow(this.pbElement, "Personal Best:", "Loading...");
      return;
    }

    if (pbMs === null) {
      this.renderStatRow(this.pbElement, "Personal Best:", "N/A");
      return;
    }

    this.renderStatRow(
      this.pbElement,
      "Personal Best:",
      formatTime(pbMs),
      "#60a5fa",
    );
  }

  private renderStatRow(
    target: HTMLDivElement,
    label: string,
    value: string,
    valueColor?: string,
  ): void {
    target.replaceChildren();

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    if (valueColor) {
      valueEl.style.color = valueColor;
    }

    target.append(labelEl, valueEl);
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
