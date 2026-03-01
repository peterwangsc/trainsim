import { ASSETS_CDN_BASE } from "@/game/Config";
import { GameState } from "@/game/GameState";
import {
  LeaderboardSectionComponent,
  LeaderboardSkeletonComponent,
  LoadingSplashComponent,
  type LeaderboardRow,
} from "@/ui/components/LoadingSplash";
import { saveSoundSettings } from "@/util/Username";
import { getMaxLevelWithTimes, getTopTimesForLevels } from "@/util/TrackTimes";

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
  private readonly usernameInput: HTMLInputElement | null;

  private readonly creditsBtn: HTMLButtonElement;
  private readonly settingsBtn: HTMLButtonElement;
  private readonly settingsIconGear: HTMLSpanElement;
  private readonly settingsIconClose: HTMLSpanElement;
  private readonly settingsPage: HTMLDivElement;
  private readonly creditsPage: HTMLDivElement;
  private readonly leaderboardsContainer: HTMLDivElement;
  private readonly loadLeaderboardsBtn: HTMLButtonElement;
  private readonly creditsLink: HTMLAnchorElement;
  private readonly shareBtn: HTMLButtonElement;

  private readonly masterSlider: HTMLInputElement;
  private readonly musicSlider: HTMLInputElement;
  private readonly sfxSlider: HTMLInputElement;

  private readonly handleTapBound: () => void;
  private readonly handleCreditsClickBound: () => void;
  private readonly handleSettingsClickBound: () => void;
  private readonly handleShareClickBound: () => void;
  private readonly handleLoadLeaderboardsBound: () => void;
  private readonly handleCreditsLinkEnterBound: () => void;
  private readonly handleCreditsLinkLeaveBound: () => void;
  private readonly handleShareBtnEnterBound: () => void;
  private readonly handleShareBtnLeaveBound: () => void;

  private dismissed = false;
  private isReady = false;
  private isStarting = false;
  private activePage: "none" | "settings" | "credits" = "none";
  private leaderboardsLoaded = false;
  private currentLoadMaxLevel: number | null = null;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    private readonly onStart: (
      enteredUsername?: string,
    ) => Promise<void> | void,
  ) {
    this.gameState = gameState;

    this.handleTapBound = this.onTap.bind(this);
    this.handleCreditsClickBound = this.handleCreditsClick.bind(this);
    this.handleSettingsClickBound = this.handleSettingsClick.bind(this);
    this.handleShareClickBound = this.handleShareClick.bind(this);
    this.handleLoadLeaderboardsBound = this.handleLoadLeaderboards.bind(this);
    this.handleCreditsLinkEnterBound = () => {
      this.creditsLink.style.color = "#fff";
    };
    this.handleCreditsLinkLeaveBound = () => {
      this.creditsLink.style.color = "rgba(255, 255, 255, 0.7)";
    };
    this.handleShareBtnEnterBound = () => {
      this.shareBtn.style.color = "#fff";
    };
    this.handleShareBtnLeaveBound = () => {
      this.shareBtn.style.color = "rgba(255, 255, 255, 0.7)";
    };

    this.root = LoadingSplashComponent({
      logoSrc: `${ASSETS_CDN_BASE}/og.png`,
      showUsernameInput: !this.gameState.username,
      onStartClick: this.handleTapBound,
      onCreditsClick: this.handleCreditsClickBound,
      onSettingsClick: this.handleSettingsClickBound,
      onShareClick: this.handleShareClickBound,
    });

    this.progressLabel = this.root.querySelector(
      "#loading-progress-label",
    ) as HTMLParagraphElement;
    this.progressTrack = this.root.querySelector(
      "#loading-progress-track",
    ) as HTMLDivElement;
    this.progressFill = this.root.querySelector(
      "#loading-progress-fill",
    ) as HTMLDivElement;
    this.cta = this.root.querySelector("#loading-cta") as HTMLButtonElement;
    this.usernameInput = this.root.querySelector(
      "#loading-username-input",
    ) as HTMLInputElement | null;

    this.creditsBtn = this.root.querySelector(
      "#loading-credits-btn",
    ) as HTMLButtonElement;
    this.settingsBtn = this.root.querySelector(
      "#loading-settings-btn",
    ) as HTMLButtonElement;
    this.settingsIconGear = this.root.querySelector(
      "#loading-settings-icon-gear",
    ) as HTMLSpanElement;
    this.settingsIconClose = this.root.querySelector(
      "#loading-settings-icon-close",
    ) as HTMLSpanElement;
    this.settingsPage = this.root.querySelector(
      "#loading-settings-page",
    ) as HTMLDivElement;
    this.creditsPage = this.root.querySelector(
      "#loading-credits-page",
    ) as HTMLDivElement;
    this.leaderboardsContainer = this.root.querySelector(
      "#loading-leaderboards-container",
    ) as HTMLDivElement;
    this.loadLeaderboardsBtn = this.root.querySelector(
      "#loading-load-leaderboards-btn",
    ) as HTMLButtonElement;
    this.creditsLink = this.root.querySelector(
      "#loading-credits-link",
    ) as HTMLAnchorElement;
    this.shareBtn = this.root.querySelector(
      "#loading-share-btn",
    ) as HTMLButtonElement;

    this.masterSlider = this.root.querySelector(
      "#master-volume",
    ) as HTMLInputElement;
    this.musicSlider = this.root.querySelector(
      "#music-volume",
    ) as HTMLInputElement;
    this.sfxSlider = this.root.querySelector("#sfx-volume") as HTMLInputElement;

    this.setupVolumeControls();
    this.setupCreditsControls();

    container.appendChild(this.root);
  }

  private setupVolumeControls(): void {
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
  }

  private setupCreditsControls(): void {
    this.loadLeaderboardsBtn.addEventListener(
      "click",
      this.handleLoadLeaderboardsBound,
    );
    this.creditsLink.addEventListener("mouseenter", this.handleCreditsLinkEnterBound);
    this.creditsLink.addEventListener("mouseleave", this.handleCreditsLinkLeaveBound);
    this.shareBtn.addEventListener("mouseenter", this.handleShareBtnEnterBound);
    this.shareBtn.addEventListener("mouseleave", this.handleShareBtnLeaveBound);
  }

  private handleCreditsClick(): void {
    if (this.activePage === "credits") {
      this.openPage("none");
      return;
    }

    this.openPage("credits");
    if (!this.leaderboardsLoaded) {
      this.leaderboardsLoaded = true;
      void this.renderLeaderboards(null);
    }
  }

  private handleSettingsClick(): void {
    if (this.activePage === "settings") {
      this.openPage("none");
      return;
    }

    this.openPage("settings");
  }

  private handleLoadLeaderboards(): void {
    void this.renderLeaderboards(this.currentLoadMaxLevel);
  }

  private async renderLeaderboards(startMaxLevel: number | null): Promise<void> {
    this.loadLeaderboardsBtn.style.display = "none";

    const skeletons = [
      LeaderboardSkeletonComponent(),
      LeaderboardSkeletonComponent(),
    ];
    skeletons.forEach((skeleton) =>
      this.leaderboardsContainer.appendChild(skeleton),
    );

    let maxToLoad = startMaxLevel;
    if (maxToLoad === null) {
      maxToLoad = await getMaxLevelWithTimes();
    }

    const minToLoad = Math.max(1, maxToLoad - 10);
    const leaderboards = await getTopTimesForLevels(maxToLoad, minToLoad);

    skeletons.forEach((skeleton) => skeleton.remove());

    for (const leaderboard of leaderboards) {
      const rows: LeaderboardRow[] = leaderboard.records
        .slice(0, 3)
        .map((record, idx) => ({
          rank: idx + 1,
          username: record.username,
          timeText: formatTime(record.timeMs),
          rankColor:
            idx === 0 ? "#fbbf24" : idx === 1 ? "#9ca3af" : "#b45309",
        }));

      this.leaderboardsContainer.appendChild(
        LeaderboardSectionComponent({
          level: leaderboard.level,
          rows,
        }),
      );
    }

    this.currentLoadMaxLevel = minToLoad - 1;

    if (this.currentLoadMaxLevel >= 1) {
      this.loadLeaderboardsBtn.textContent = "Show More";
      this.loadLeaderboardsBtn.disabled = false;
      this.loadLeaderboardsBtn.style.display = "inline-block";
    } else {
      this.loadLeaderboardsBtn.style.display = "none";
    }
  }

  private handleShareClick(): void {
    const shareData = {
      title: "TrainSim",
      text: "Drive trains in 3D in your browser!",
      url: "https://trainsim.io/",
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareData.url);
      alert("Link copied to clipboard!");
    }
  }

  public setSoundSettings(master: number, music: number, sfx: number): void {
    this.masterSlider.value = master.toString();
    this.musicSlider.value = music.toString();
    this.sfxSlider.value = sfx.toString();
  }

  private openPage(pageName: "none" | "settings" | "credits"): void {
    this.activePage = pageName;

    this.settingsPage.classList.remove("loading-splash__page--visible");
    this.creditsPage.classList.remove("loading-splash__page--visible");
    this.creditsBtn.textContent = "Credits";
    this.settingsIconGear.style.display = "inline-flex";
    this.settingsIconClose.style.display = "none";

    if (pageName === "settings") {
      this.settingsPage.classList.add("loading-splash__page--visible");
      this.settingsIconGear.style.display = "none";
      this.settingsIconClose.style.display = "inline-flex";
    } else if (pageName === "credits") {
      this.creditsPage.classList.add("loading-splash__page--visible");
      this.creditsBtn.textContent = "< Back";
    }
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
    window.setTimeout(remove, 4000);
  }
}
