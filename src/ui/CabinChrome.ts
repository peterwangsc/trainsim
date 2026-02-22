const DYNAMIC_HEIGHT_CSS_VAR = "--app-dynamic-height";

export class CabinChrome {
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "cabin-chrome";
    this.root.setAttribute("aria-hidden", "true");

    const roof = document.createElement("div");
    roof.className = "cabin-chrome__roof";

    const leftPillar = document.createElement("div");
    leftPillar.className = "cabin-chrome__pillar cabin-chrome__pillar--left";

    const rightPillar = document.createElement("div");
    rightPillar.className = "cabin-chrome__pillar cabin-chrome__pillar--right";

    const sill = document.createElement("div");
    sill.className = "cabin-chrome__sill";

    const glassSheen = document.createElement("div");
    glassSheen.className = "cabin-chrome__glass-sheen";

    this.root.append(roof, leftPillar, rightPillar, sill, glassSheen);
    container.appendChild(this.root);
    this.syncViewportMetrics();
    window.addEventListener("resize", this.syncViewportMetrics);
    window.visualViewport?.addEventListener("resize", this.syncViewportMetrics);
    window.visualViewport?.addEventListener("scroll", this.syncViewportMetrics);
  }

  dispose(): void {
    window.removeEventListener("resize", this.syncViewportMetrics);
    window.visualViewport?.removeEventListener("resize", this.syncViewportMetrics);
    window.visualViewport?.removeEventListener("scroll", this.syncViewportMetrics);
    this.root.remove();
  }

  private syncViewportMetrics = (): void => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty(
      DYNAMIC_HEIGHT_CSS_VAR,
      `${Math.round(viewportHeight)}px`,
    );
  };
}
