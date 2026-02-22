import { ASSETS_CDN_BASE } from "../game/Config";

export class MobileSplash {
  private readonly root: HTMLDivElement;
  private dismissed = false;

  constructor(container: HTMLElement, private readonly onReady: () => void) {
    this.root = document.createElement("div");
    this.root.className = "mobile-splash";
    this.root.setAttribute("role", "button");
    this.root.setAttribute("aria-label", "Tap to start");

    const card = document.createElement("div");
    card.className = "mobile-splash__card";

    const logo = document.createElement("img");
    logo.className = "mobile-splash__logo";
    logo.src = `${ASSETS_CDN_BASE}/og.png`;
    logo.alt = "TrainSim";
    logo.decoding = "async";
    logo.loading = "eager";
    logo.draggable = false;

    const hint = document.createElement("p");
    hint.className = "mobile-splash__hint";
    hint.textContent =
      "Navigate your train to the terminal station. Stop before the platform ends.";

    const cta = document.createElement("div");
    cta.className = "mobile-splash__cta";
    cta.textContent = "Tap to Start";

    card.append(logo, hint, cta);
    this.root.appendChild(card);
    container.appendChild(this.root);

    this.root.addEventListener("click", this.onTap, { once: true });
  }

  dispose(): void {
    this.root.remove();
  }

  private onTap = (): void => {
    // onReady must be called within the event handler so the browser
    // treats the subsequent AudioContext.resume() as user-gesture-gated.
    this.onReady();
    this.dismiss();
  };

  private dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.root.classList.add("mobile-splash--out");
    const remove = (): void => this.root.remove();
    const tid = window.setTimeout(remove, 500);
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
