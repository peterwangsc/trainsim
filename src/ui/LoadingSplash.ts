import { ASSETS_CDN_BASE } from "../game/Config";
import { GameState } from "../game/GameState";
import { saveSoundSettings } from "../util/Username";
import { getMaxLevelWithTimes, getTopTimesForLevels } from "../util/Supabase";

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

export class LoadingSplash {
  private readonly root: HTMLDivElement;
  private readonly gameState: GameState;
  private readonly progressLabel: HTMLParagraphElement;
  private readonly progressTrack: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;
  private readonly cta: HTMLButtonElement;
  private readonly progressContainer: HTMLDivElement;
  private readonly usernameInput: HTMLInputElement | null = null;
  private dismissed = false;
  private isReady = false;
  private isStarting = false;

  private creditsBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private settingsPage!: HTMLDivElement;
  private creditsPage!: HTMLDivElement;
  private activePage: "none" | "settings" | "credits" = "none";
  private masterSlider!: HTMLInputElement;
  private musicSlider!: HTMLInputElement;
  private sfxSlider!: HTMLInputElement;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    private readonly onStart: (
      enteredUsername?: string,
    ) => Promise<void> | void,
  ) {
    this.gameState = gameState;
    this.root = document.createElement("div");
    this.root.className = "loading-splash";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-live", "polite");

    const card = document.createElement("div");
    card.className = "loading-splash__card";

    const logo = document.createElement("img");
    logo.className = "loading-splash__logo";
    logo.src = `${ASSETS_CDN_BASE}/og.png`;
    logo.alt = "TrainSim";
    logo.decoding = "async";
    logo.loading = "eager";
    logo.draggable = false;

    const hint = document.createElement("p");
    hint.className = "loading-splash__hint";
    hint.innerHTML =
      "Navigate your train to the terminal station.<br/>Stop before the platform ends.";

    this.progressLabel = document.createElement("p");
    this.progressLabel.className = "loading-splash__progress-label";
    this.progressLabel.textContent = "Loading 0%";

    this.progressTrack = document.createElement("div");
    this.progressTrack.className = "loading-splash__progress-track";

    this.progressFill = document.createElement("div");
    this.progressFill.className = "loading-splash__progress-fill";
    this.progressTrack.appendChild(this.progressFill);

    this.cta = document.createElement("button");
    this.cta.className = "loading-splash__cta loading-splash__cta--hidden";
    this.cta.type = "button";
    this.cta.textContent = `Push to Start`;
    this.cta.addEventListener("click", () => this.onTap());

    this.progressContainer = document.createElement("div");
    this.progressContainer.className = "loading-splash__progress-container";
    this.progressContainer.appendChild(hint);

    const ctaContainer = document.createElement("div");
    ctaContainer.className = "loading-splash__cta-container";
    ctaContainer.appendChild(this.progressLabel);
    ctaContainer.appendChild(this.progressTrack);

    if (!this.gameState.username) {
      this.usernameInput = document.createElement("input");
      this.usernameInput.type = "text";
      this.usernameInput.placeholder = "Username (Optional)";
      this.usernameInput.className = "loading-splash__username-input";
      this.usernameInput.style.display = "none";
      ctaContainer.appendChild(this.usernameInput);
    }

    ctaContainer.appendChild(this.cta);
    this.progressContainer.appendChild(ctaContainer);

    card.append(logo, this.progressContainer);
    this.root.appendChild(card);

    this.buildOverlays();

    container.appendChild(this.root);
  }

  private buildOverlays(): void {
    const header = document.createElement("div");
    header.className = "loading-splash__header";

    let leaderboardsLoaded = false;
    let currentLoadMaxLevel: number | null = null;
    const leaderboardsContainer = document.createElement("div");
    leaderboardsContainer.className = "leaderboards-container";
    leaderboardsContainer.style.width = "100%";
    leaderboardsContainer.style.maxWidth = "600px";
    leaderboardsContainer.style.margin = "0 auto";

    const loadLeaderboardsBtn = document.createElement("button");
    loadLeaderboardsBtn.className = "loading-splash__cta";
    loadLeaderboardsBtn.style.marginTop = "16px";
    loadLeaderboardsBtn.style.marginBottom = "24px";
    loadLeaderboardsBtn.style.fontSize = "14px";
    loadLeaderboardsBtn.style.padding = "8px 16px";
    loadLeaderboardsBtn.style.display = "none";
    loadLeaderboardsBtn.textContent = "Loading Leaderboards...";

    const renderLeaderboards = async (startMaxLevel: number | null) => {
      loadLeaderboardsBtn.disabled = true;
      loadLeaderboardsBtn.textContent = "Loading...";
      loadLeaderboardsBtn.style.display = "block";

      let maxToLoad = startMaxLevel;
      if (maxToLoad === null) {
        maxToLoad = await getMaxLevelWithTimes();
      }

      const minToLoad = Math.max(1, maxToLoad - 10);
      const leaderboards = await getTopTimesForLevels(maxToLoad, minToLoad);

      for (const lb of leaderboards) {
        const lbSection = document.createElement("div");
        lbSection.style.marginBottom = "16px";
        lbSection.style.background = "rgba(0,0,0,0.3)";
        lbSection.style.padding = "12px";
        lbSection.style.borderRadius = "8px";
        lbSection.style.border = "1px solid rgba(255,255,255,0.1)";

        const title = document.createElement("h3");
        title.textContent = `Level ${lb.level}`;
        title.style.marginTop = "0";
        title.style.marginBottom = "8px";
        title.style.fontSize = "16px";
        title.style.color = "#fff";
        title.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
        title.style.paddingBottom = "4px";
        lbSection.appendChild(title);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";

        lb.records.slice(0, 3).forEach((record, idx) => {
          const tr = document.createElement("tr");

          const tdRank = document.createElement("td");
          tdRank.textContent = `#${idx + 1}`;
          tdRank.style.color =
            idx === 0 ? "#fbbf24" : idx === 1 ? "#9ca3af" : "#b45309";
          tdRank.style.width = "40px";
          tdRank.style.padding = "4px 0";

          const tdName = document.createElement("td");
          tdName.textContent = record.username;
          tdName.style.padding = "4px 0";
          tdName.style.overflow = "hidden";
          tdName.style.textOverflow = "ellipsis";
          tdName.style.whiteSpace = "nowrap";
          tdName.style.maxWidth = "120px";

          const tdTime = document.createElement("td");
          tdTime.textContent = formatTime(record.timeMs);
          tdTime.style.textAlign = "right";
          tdTime.style.fontFamily = "monospace";
          tdTime.style.padding = "4px 0";
          tdTime.style.color = "#4ade80";

          tr.append(tdRank, tdName, tdTime);
          table.appendChild(tr);
        });

        lbSection.appendChild(table);
        leaderboardsContainer.appendChild(lbSection);
      }

      currentLoadMaxLevel = minToLoad - 1;

      if (currentLoadMaxLevel >= 1) {
        loadLeaderboardsBtn.textContent = "Show More";
        loadLeaderboardsBtn.disabled = false;
      } else {
        loadLeaderboardsBtn.style.display = "none";
      }
    };

    loadLeaderboardsBtn.addEventListener("click", () =>
      renderLeaderboards(currentLoadMaxLevel),
    );

    this.creditsBtn = document.createElement("button");
    this.creditsBtn.className = "loading-splash__credits-btn";
    this.creditsBtn.textContent = "Credits";
    this.creditsBtn.addEventListener("click", () => {
      if (this.activePage === "credits") {
        this.openPage("none");
      } else {
        this.openPage("credits");
        if (!leaderboardsLoaded) {
          leaderboardsLoaded = true;
          renderLeaderboards(null);
        }
      }
    });

    this.settingsBtn = document.createElement("button");
    this.settingsBtn.className = "loading-splash__settings-btn";
    this.settingsBtn.innerHTML = this.getSettingsIcon();
    this.settingsBtn.addEventListener("click", () => {
      if (this.activePage === "settings") {
        this.openPage("none");
      } else {
        this.openPage("settings");
      }
    });

    header.appendChild(this.creditsBtn);
    header.appendChild(this.settingsBtn);

    const createSlider = (
      label: string,
      id: string,
    ): [HTMLDivElement, HTMLInputElement] => {
      const container = document.createElement("div");
      container.className = "throttle-slider-container";

      const wrapper = document.createElement("div");
      wrapper.className = "throttle-slider-wrapper";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = id;
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.01";
      slider.className = "throttle-slider";

      wrapper.appendChild(slider);

      const labelEl = document.createElement("label");
      labelEl.htmlFor = id;
      labelEl.textContent = label;
      labelEl.className = "throttle-slider-label";

      container.appendChild(wrapper);
      container.appendChild(labelEl);

      return [container, slider];
    };

    const settingsLayout = document.createElement("div");
    settingsLayout.className = "settings-layout";

    const tutorialPanel = document.createElement("div");
    tutorialPanel.className = "settings-panel";

    const tutorialTitle = document.createElement("h3");
    tutorialTitle.textContent = "How to Play";
    tutorialPanel.appendChild(tutorialTitle);

    const tutorialText = document.createElement("div");
    tutorialText.className = "tutorial-content";
    tutorialText.innerHTML = `
      <p><strong>Controls:</strong> Push up on the slider to apply throttle. Using the <strong>Up/Down</strong> or <strong>W/S</strong> keys on a keyboard also works. Hold the <strong>Spacebar</strong> or <strong>STOP</strong> button to apply the brakes.</p>
      <p><strong>Comfort:</strong> Going too fast, braking too hard, or taking too long will severely reduce passenger comfort. If comfort reaches 0%, you're not doing it right.</p>
    `;
    tutorialPanel.append(tutorialText);

    const slidersPanel = document.createElement("div");
    slidersPanel.className = "settings-panel";

    const slidersTitle = document.createElement("h3");
    slidersTitle.textContent = "Audio Mix";

    const slidersContainer = document.createElement("div");
    slidersContainer.className = "throttle-sliders";

    const [masterContainer, masterSlider] = createSlider(
      "Master",
      "master-volume",
    );
    const [musicContainer, musicSlider] = createSlider("Music", "music-volume");
    const [sfxContainer, sfxSlider] = createSlider("SFX", "sfx-volume");

    this.masterSlider = masterSlider;
    this.musicSlider = musicSlider;
    this.sfxSlider = sfxSlider;

    slidersContainer.append(masterContainer, musicContainer, sfxContainer);
    slidersPanel.append(slidersTitle, slidersContainer);

    settingsLayout.append(tutorialPanel, slidersPanel);

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

    this.settingsPage = this.createPage(settingsLayout);

    const creditsContent = document.createElement("div");
    creditsContent.style.padding = "16px";

    creditsContent.append(leaderboardsContainer, loadLeaderboardsBtn);

    const oldCreditsContainer = document.createElement("div");
    oldCreditsContainer.style.textAlign = "center";
    oldCreditsContainer.style.marginTop = "24px";
    oldCreditsContainer.style.borderTop = "1px solid rgba(255,255,255,0.1)";
    oldCreditsContainer.style.paddingTop = "16px";

    const link = document.createElement("a");
    link.href = "https://trainsim.io";
    link.target = "_blank";
    link.textContent = "https://trainsim.io";
    link.style.color = "#4da6ff";
    link.style.display = "block";
    link.style.marginBottom = "12px";

    const email = document.createElement("p");
    email.textContent =
      "peterwangsc on github, linkedin, youtube, gmail and itch.io";

    oldCreditsContainer.append(link, email);
    creditsContent.appendChild(oldCreditsContainer);

    this.creditsPage = this.createPage(creditsContent);

    this.root.appendChild(header);
    this.root.appendChild(this.settingsPage);
    this.root.appendChild(this.creditsPage);
  }

  private createPage(contentNode: HTMLElement): HTMLDivElement {
    const page = document.createElement("div");
    page.className = "loading-splash__page";

    const content = document.createElement("div");
    content.className = "loading-splash__page-content";

    content.appendChild(contentNode);
    page.appendChild(content);

    return page;
  }

  public setSoundSettings(master: number, music: number, sfx: number): void {
    if (this.masterSlider) this.masterSlider.value = master.toString();
    if (this.musicSlider) this.musicSlider.value = music.toString();
    if (this.sfxSlider) this.sfxSlider.value = sfx.toString();
  }

  private openPage(pageName: "none" | "settings" | "credits"): void {
    this.activePage = pageName;

    // Reset both
    this.settingsPage.classList.remove("loading-splash__page--visible");
    this.creditsPage.classList.remove("loading-splash__page--visible");
    this.creditsBtn.textContent = "Credits";
    this.settingsBtn.innerHTML = this.getSettingsIcon();

    if (pageName === "settings") {
      this.settingsPage.classList.add("loading-splash__page--visible");
      this.settingsBtn.innerHTML = this.getCloseIcon();
    } else if (pageName === "credits") {
      this.creditsPage.classList.add("loading-splash__page--visible");
      this.creditsBtn.textContent = "< Back";
    }
  }

  private getSettingsIcon(): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  }

  private getCloseIcon(): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  }

  dispose(): void {
    this.root.remove();
  }

  public setProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const pct = Math.round(clamped * 100);
    this.progressFill.style.width = `${pct}%`;
    if (!this.isReady) {
      this.progressLabel.textContent = `Loading ${pct}%`;
    }
  }

  public async setReady(): Promise<void> {
    this.isReady = true;
    this.setProgress(1);
    this.progressLabel.style.display = "none";
    this.progressTrack.style.display = "none";
    if (this.usernameInput) {
      this.usernameInput.style.display = "block";
    }
    this.cta.className = "loading-splash__cta";
  }

  public setError(message: string): void {
    this.isReady = false;
    this.isStarting = false;
    this.progressLabel.textContent = message;
    this.cta.disabled = true;
    this.cta.textContent = "Unavailable";
    if (this.usernameInput) {
      this.usernameInput.style.display = "none";
    }
  }

  private async onTap(): Promise<void> {
    if (!this.isReady || this.isStarting) {
      return;
    }

    this.isStarting = true;
    this.cta.disabled = true;
    this.cta.textContent = "Starting";
    if (this.usernameInput) {
      this.usernameInput.disabled = true;
    }
    this.root.classList.add("loading-splash--out");

    try {
      const enteredUsername = this.usernameInput?.value.trim() || undefined;
      await this.onStart(enteredUsername);
      this.dismiss();
    } catch (error) {
      this.root.classList.remove("loading-splash--out");
      console.error(error);
      this.isStarting = false;
      if (this.isReady) {
        this.cta.disabled = false;
        this.cta.textContent = "Error. Try again";
        if (this.usernameInput) {
          this.usernameInput.disabled = false;
        }
      }
    }
  }

  private dismiss(): void {
    if (this.dismissed) {
      return;
    }

    this.dismissed = true;
    const remove = (): void => this.root.remove();
    this.root.addEventListener("transitionend", remove, { once: true });
    window.setTimeout(remove, 4000); // Fallback
  }
}
