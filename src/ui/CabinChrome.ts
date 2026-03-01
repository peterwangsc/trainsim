import { CabinChromeComponent } from "@/ui/components/Cabin";

export class CabinChrome {
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = CabinChromeComponent();
    container.appendChild(this.root);
  }

  public dispose(): void {
    this.root.remove();
  }
}
