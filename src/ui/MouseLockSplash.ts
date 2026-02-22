type PointerLockTarget = HTMLElement & {
  requestPointerLock: () => Promise<void> | void;
};

export class MouseLockSplash {
  private readonly root: HTMLDivElement;
  private readonly lockTarget: PointerLockTarget;
  private readonly hasPointerLockSupport: boolean;

  constructor(container: HTMLElement, lockTarget: HTMLElement) {
    this.lockTarget = lockTarget as PointerLockTarget;
    this.hasPointerLockSupport =
      typeof document.pointerLockElement !== "undefined" &&
      typeof this.lockTarget.requestPointerLock === "function";

    this.root = document.createElement("div");
    this.root.className = "mouse-lock-splash";
    this.root.tabIndex = 0;
    this.root.setAttribute("role", "button");
    this.root.setAttribute(
      "aria-label",
      "Click to recapture mouse and continue driving",
    );

    const logo = document.createElement("img");
    logo.className = "mouse-lock-splash__logo";
    logo.src = "/og.png";
    logo.alt = "TrainSim";
    logo.decoding = "async";
    logo.loading = "eager";

    const hint = document.createElement("p");
    hint.className = "mouse-lock-splash__hint";
    hint.textContent = "Click to continue";

    this.root.append(logo, hint);
    container.appendChild(this.root);

    this.root.addEventListener("click", this.onActivate);
    this.root.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockChange);
    window.addEventListener("blur", this.onPointerLockChange);

    this.syncVisibility();
  }

  dispose(): void {
    this.root.removeEventListener("click", this.onActivate);
    this.root.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("pointerlockerror", this.onPointerLockChange);
    window.removeEventListener("blur", this.onPointerLockChange);
    this.root.remove();
  }

  private onActivate = (): void => {
    this.requestPointerLock();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    this.requestPointerLock();
  };

  private onPointerLockChange = (): void => {
    this.syncVisibility();
  };

  private syncVisibility(): void {
    if (!this.hasPointerLockSupport) {
      this.root.classList.add("mouse-lock-splash--hidden");
      this.root.setAttribute("aria-hidden", "true");
      return;
    }

    const isLocked = document.pointerLockElement === this.lockTarget;
    this.root.classList.toggle("mouse-lock-splash--hidden", isLocked);
    this.root.setAttribute("aria-hidden", isLocked ? "true" : "false");
  }

  private requestPointerLock(): void {
    if (!this.hasPointerLockSupport) {
      return;
    }

    if (document.pointerLockElement === this.lockTarget) {
      return;
    }

    const requestResult = this.lockTarget.requestPointerLock();
    if (requestResult && typeof requestResult.then === "function") {
      void requestResult.catch(() => {
        this.syncVisibility();
      });
    }
  }
}
