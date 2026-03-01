import { GameState } from "@/game/GameState";
import { saveSoundSettings } from "@/util/Username";

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
  private readonly onLevelSelect: (level: number) => void;
  
  private masterSlider!: HTMLInputElement;
  private musicSlider!: HTMLInputElement;
  private sfxSlider!: HTMLInputElement;
  private levelSelect!: HTMLSelectElement;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    onLevelSelect: (level: number) => void,
  ) {
    this.gameState = gameState;
    this.onLevelSelect = onLevelSelect;
    this.root = document.createElement("div");
    this.root.className = "login-screen login-screen--hidden";
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.hide();
      }
    });

    const card = document.createElement("div");
    card.className = "settings-panel settings-panel--compact";
    card.style.maxWidth = "800px";
    card.style.width = "min(92vw, 800px)";
    card.style.height = "auto";
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

    const levelTitle = document.createElement("h3");
    levelTitle.textContent = "Level Selection";

    const levelRow = document.createElement("div");
    levelRow.style.display = "flex";
    levelRow.style.flexDirection = "column";
    levelRow.style.alignItems = "center";
    levelRow.style.width = "100%";
    levelRow.style.gap = "16px";
    levelRow.style.marginTop = "16px";

    this.levelSelect = document.createElement("select");
    this.levelSelect.style.width = "200px";
    this.levelSelect.style.padding = "10px";
    this.levelSelect.style.borderRadius = "4px";
    this.levelSelect.style.fontSize = "16px";
    this.levelSelect.style.backgroundColor = "#222";
    this.levelSelect.style.color = "#fff";
    this.levelSelect.style.border = "1px solid #444";

    const loadBtn = document.createElement("button");
    loadBtn.className = "run-end-overlay__restart";
    loadBtn.textContent = "Load Level";
    loadBtn.style.margin = "0";
    loadBtn.style.padding = "10px 0";
    loadBtn.style.fontSize = "14px";
    loadBtn.style.width = "200px";
    loadBtn.addEventListener("click", () => {
      const level = parseInt(this.levelSelect.value, 10);
      if (level === this.gameState.level) {
        this.hide();
        return;
      }
      this.onLevelSelect(level);
      this.hide();
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "login-screen__logout-button";
    closeBtn.textContent = "Cancel";
    closeBtn.style.margin = "0";
    closeBtn.style.padding = "10px 0";
    closeBtn.style.fontSize = "14px";
    closeBtn.style.width = "200px";
    closeBtn.style.background = "rgba(255, 255, 255, 0.1)";
    closeBtn.style.color = "#fff";
    closeBtn.style.border = "1px solid rgba(255, 255, 255, 0.3)";
    closeBtn.addEventListener("click", () => this.hide());

    levelRow.append(this.levelSelect, loadBtn, closeBtn);

    const contentLayout = document.createElement("div");
    contentLayout.className = "settings-panel__content";

    const audioSection = document.createElement("div");
    audioSection.className = "settings-panel__section";
    audioSection.append(title, slidersContainer);

    const levelSection = document.createElement("div");
    levelSection.className = "settings-panel__section";
    levelSection.append(levelTitle, levelRow);

    contentLayout.append(audioSection, levelSection);

    card.append(contentLayout);
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  public reset(): void {
    this.masterSlider.value = this.gameState.masterVolume.toString();
    this.musicSlider.value = this.gameState.musicVolume.toString();
    this.sfxSlider.value = this.gameState.sfxVolume.toString();

    // Populate level select
    this.levelSelect.innerHTML = "";
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
}