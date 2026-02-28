import { GameState } from "../game/GameState";
import { saveSoundSettings } from "../util/Username";

function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
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
  
  private masterSlider!: HTMLInputElement;
  private musicSlider!: HTMLInputElement;
  private sfxSlider!: HTMLInputElement;

  constructor(
    container: HTMLElement,
    gameState: GameState,
  ) {
    this.gameState = gameState;
    this.root = document.createElement("div");
    this.root.className = "login-screen login-screen--hidden";
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.hide();
      }
    });

    const card = document.createElement("div");
    card.className = "settings-panel";
    card.style.maxWidth = "600px";
    card.style.width = "100%";
    card.style.maxHeight = "90dvh";
    card.style.overflowY = "auto";
    card.style.margin = "auto"; // Center the panel
    
    // Stop clicks from propagating to root so the overlay doesn't close
    card.addEventListener("click", (e) => e.stopPropagation());

    const title = document.createElement("h3");
    title.textContent = "Audio Mix";

    const slidersContainer = document.createElement("div");
    slidersContainer.className = "throttle-sliders";

    const createSlider = (label: string, id: string): [HTMLDivElement, HTMLInputElement] => {
      const container = document.createElement("div");
      container.className = "throttle-slider-container";

      const wrapper = document.createElement("div");
      wrapper.className = "throttle-slider-wrapper";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = `ingame-${id}`;
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.01";
      slider.className = "throttle-slider";

      wrapper.appendChild(slider);

      const labelEl = document.createElement("label");
      labelEl.htmlFor = `ingame-${id}`;
      labelEl.textContent = label;
      labelEl.className = "throttle-slider-label";

      container.appendChild(wrapper);
      container.appendChild(labelEl);

      return [container, slider];
    };

    const [masterContainer, masterSlider] = createSlider("Master", "master-volume");
    const [musicContainer, musicSlider] = createSlider("Music", "music-volume");
    const [sfxContainer, sfxSlider] = createSlider("SFX", "sfx-volume");
    
    this.masterSlider = masterSlider;
    this.musicSlider = musicSlider;
    this.sfxSlider = sfxSlider;

    slidersContainer.append(masterContainer, musicContainer, sfxContainer);

    const handleVolumeChange = debounce(() => {
      const master = parseFloat(this.masterSlider.value);
      const music = parseFloat(this.musicSlider.value);
      const sfx = parseFloat(this.sfxSlider.value);
      this.gameState.update({ masterVolume: master, musicVolume: music, sfxVolume: sfx });
      if (this.gameState.userId) {
        saveSoundSettings(this.gameState.userId, master, music, sfx);
      }
    }, 500);

    this.masterSlider.addEventListener("input", handleVolumeChange);
    this.musicSlider.addEventListener("input", handleVolumeChange);
    this.sfxSlider.addEventListener("input", handleVolumeChange);

    const closeBtn = document.createElement("button");
    closeBtn.className = "login-screen__logout-button";
    closeBtn.textContent = "Close";
    closeBtn.style.marginTop = "32px";
    closeBtn.style.alignSelf = "center";
    closeBtn.addEventListener("click", () => this.hide());

    card.append(title, slidersContainer, closeBtn);
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  public reset(): void {
    this.masterSlider.value = this.gameState.masterVolume.toString();
    this.musicSlider.value = this.gameState.musicVolume.toString();
    this.sfxSlider.value = this.gameState.sfxVolume.toString();
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
}