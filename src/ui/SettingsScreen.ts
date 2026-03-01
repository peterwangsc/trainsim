import { GameState } from "@/game/GameState";
import { SettingsScreenComponent } from "@/ui/components/SettingsScreen";
import { saveSoundSettings } from "@/util/Username";

function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

export class SettingsScreen {
  private readonly root: HTMLDivElement;
  private readonly gameState: GameState;
  private readonly onLevelSelect: (level: number) => void;

  private readonly masterSlider: HTMLInputElement;
  private readonly musicSlider: HTMLInputElement;
  private readonly sfxSlider: HTMLInputElement;
  private readonly levelSelect: HTMLSelectElement;

  private readonly handleOverlayClickBound: (event: MouseEvent) => void;
  private readonly handleCardClickBound: (event: MouseEvent) => void;
  private readonly handleLoadClickBound: () => void;
  private readonly handleCancelClickBound: () => void;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    onLevelSelect: (level: number) => void,
  ) {
    this.gameState = gameState;
    this.onLevelSelect = onLevelSelect;

    this.handleOverlayClickBound = this.handleOverlayClick.bind(this);
    this.handleCardClickBound = this.handleCardClick.bind(this);
    this.handleLoadClickBound = this.handleLoadClick.bind(this);
    this.handleCancelClickBound = this.hide.bind(this);

    this.root = SettingsScreenComponent({
      onOverlayClick: this.handleOverlayClickBound,
      onCardClick: this.handleCardClickBound,
      onLoadClick: this.handleLoadClickBound,
      onCancelClick: this.handleCancelClickBound,
    });

    this.masterSlider = this.root.querySelector(
      "#ingame-master-volume",
    ) as HTMLInputElement;
    this.musicSlider = this.root.querySelector(
      "#ingame-music-volume",
    ) as HTMLInputElement;
    this.sfxSlider = this.root.querySelector(
      "#ingame-sfx-volume",
    ) as HTMLInputElement;
    this.levelSelect = this.root.querySelector(
      "#ingame-level-select",
    ) as HTMLSelectElement;

    const handleVolumeChange = debounce(() => {
      const master = parseFloat(this.masterSlider.value);
      const music = parseFloat(this.musicSlider.value);
      const sfx = parseFloat(this.sfxSlider.value);
      this.gameState.update({
        masterVolume: master,
        musicVolume: music,
        sfxVolume: sfx,
      });
      if (this.gameState.userId) {
        saveSoundSettings(this.gameState.userId, master, music, sfx);
      }
    }, 500);

    this.masterSlider.addEventListener("input", handleVolumeChange);
    this.musicSlider.addEventListener("input", handleVolumeChange);
    this.sfxSlider.addEventListener("input", handleVolumeChange);

    container.appendChild(this.root);
  }

  public reset(): void {
    this.masterSlider.value = this.gameState.masterVolume.toString();
    this.musicSlider.value = this.gameState.musicVolume.toString();
    this.sfxSlider.value = this.gameState.sfxVolume.toString();

    this.levelSelect.replaceChildren();
    for (let i = 1; i <= this.gameState.maxLevel; i++) {
      const option = document.createElement("option");
      option.value = i.toString();
      option.textContent = `Level ${i}${i === this.gameState.level ? " (Current)" : ""}`;
      this.levelSelect.appendChild(option);
    }
    this.levelSelect.value = this.gameState.level.toString();
  }

  public dispose(): void {
    this.root.remove();
  }

  public show(): void {
    this.reset();
    this.root.classList.remove("login-screen--hidden");
    this.root.classList.add("login-screen--visible");
  }

  public hide(): void {
    this.root.classList.remove("login-screen--visible");
    this.root.classList.add("login-screen--hidden");
  }

  private handleOverlayClick(event: MouseEvent): void {
    if (event.target === this.root) {
      this.hide();
    }
  }

  private handleCardClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  private handleLoadClick(): void {
    const level = parseInt(this.levelSelect.value, 10);
    if (level === this.gameState.level) {
      this.hide();
      return;
    }
    this.onLevelSelect(level);
    this.hide();
  }
}
