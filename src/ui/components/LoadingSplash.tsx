import { VolumeSliderComponent } from "@/ui/components/VolumeSlider";

type LoadingSplashComponentProps = {
  logoSrc: string;
  showUsernameInput: boolean;
  onStartClick: () => void;
  onCreditsClick: () => void;
  onSettingsClick: () => void;
  onShareClick: () => void;
};

export type LeaderboardRow = {
  rank: number;
  username: string;
  timeText: string;
  rankColor: string;
};

type LeaderboardSectionComponentProps = {
  level: number;
  rows: LeaderboardRow[];
};

const SettingsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ShareIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
    <polyline points="16 6 12 2 8 6"></polyline>
    <line x1="12" y1="2" x2="12" y2="15"></line>
  </svg>
);

export const LoadingSplashComponent = (props: LoadingSplashComponentProps) => {
  return (
    <div class="loading-splash" role="dialog" aria-live="polite">
      <div class="loading-splash__card">
        <img
          class="loading-splash__logo"
          src={props.logoSrc}
          alt="TrainSim"
          decoding="async"
          loading="eager"
        />

        <div id="loading-progress-container" class="loading-splash__progress-container">
          <p class="loading-splash__hint">
            Navigate your train to the terminal station.
            <br />
            Stop before the platform ends.
          </p>

          <div class="loading-splash__cta-container">
            <p id="loading-progress-label" class="loading-splash__progress-label">
              Loading 0%
            </p>

            <div id="loading-progress-track" class="loading-splash__progress-track">
              <div id="loading-progress-fill" class="loading-splash__progress-fill"></div>
            </div>

            {!props.showUsernameInput ? null : (
              <input
                id="loading-username-input"
                type="text"
                placeholder="Username (Optional)"
                class="loading-splash__username-input"
                style={{ display: "none" }}
              />
            )}

            <button
              id="loading-cta"
              class="loading-splash__cta loading-splash__cta--hidden"
              type="button"
              onclick={props.onStartClick}
            >
              Push to Start
            </button>
          </div>
        </div>
      </div>

      <div class="loading-splash__header">
        <button
          id="loading-credits-btn"
          class="loading-splash__credits-btn"
          type="button"
          onclick={props.onCreditsClick}
        >
          Credits
        </button>

        <button
          id="loading-settings-btn"
          class="loading-splash__settings-btn"
          type="button"
          onclick={props.onSettingsClick}
        >
          <span id="loading-settings-icon-gear">
            <SettingsIcon />
          </span>
          <span id="loading-settings-icon-close" style={{ display: "none" }}>
            <CloseIcon />
          </span>
        </button>
      </div>

      <div id="loading-settings-page" class="loading-splash__page">
        <div class="loading-splash__page-content">
          <div class="settings-layout">
            <div class="settings-panel">
              <h3>How to Play</h3>
              <div class="tutorial-content">
                <p>
                  <strong>Controls:</strong> Push up on the slider to apply
                  throttle. Using the <strong>Up/Down</strong> or
                  <strong> W/S</strong> keys on a keyboard also works. Hold the
                  <strong> Spacebar</strong> or <strong>STOP</strong> button to
                  apply the brakes.
                </p>
                <p>
                  <strong>Comfort:</strong> Going too fast, braking too hard, or
                  taking too long will severely reduce passenger comfort. If
                  comfort reaches 0%, you&apos;re not doing it right.
                </p>
              </div>
            </div>

            <div class="settings-panel">
              <h3>Audio Mix</h3>
              <div class="throttle-sliders">
                <VolumeSliderComponent id="master-volume" label="Master" />
                <VolumeSliderComponent id="music-volume" label="Music" />
                <VolumeSliderComponent id="sfx-volume" label="SFX" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="loading-credits-page" class="loading-splash__page">
        <div class="loading-splash__page-content">
          <div style={{ padding: "16px" }}>
            <div
              id="loading-leaderboards-container"
              class="leaderboards-container"
              style={{ width: "100%", maxWidth: "600px", margin: "0 auto" }}
            ></div>

            <button
              id="loading-load-leaderboards-btn"
              class="loading-splash__cta"
              type="button"
              style={{
                marginTop: "16px",
                marginBottom: "24px",
                fontSize: "14px",
                padding: "8px 16px",
                display: "none",
              }}
            >
              Loading Leaderboards...
            </button>

            <div
              style={{
                textAlign: "center",
                marginTop: "24px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "16px",
              }}
            >
              <a
                id="loading-credits-link"
                href="https://trainsim.io"
                target="_blank"
                style={{
                  color: "rgba(255, 255, 255, 0.7)",
                  textDecoration: "none",
                  display: "block",
                  marginBottom: "12px",
                  transition: "color 0.2s ease",
                }}
              >
                trainsim.io
              </a>

              <button
                id="loading-share-btn"
                type="button"
                onclick={props.onShareClick}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.7)",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding: "0",
                  font: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  margin: "0 auto 12px auto",
                  transition: "color 0.2s ease",
                }}
              >
                <span>Share</span>
                <ShareIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LeaderboardSkeletonComponent = () => {
  return (
    <div
      class="lb-skeleton"
      style={{
        marginBottom: "16px",
        background: "rgba(255,255,255,0.05)",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.05)",
        opacity: "0.6",
      }}
    >
      <div
        style={{
          height: "16px",
          width: "80px",
          background: "rgba(255,255,255,0.1)",
          marginBottom: "12px",
          borderRadius: "4px",
        }}
      ></div>

      {[0, 1, 2].map((index) => (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: index === 2 ? "0" : "8px",
          }}
        >
          <div
            style={{
              height: "12px",
              width: "100px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "3px",
            }}
          ></div>
          <div
            style={{
              height: "12px",
              width: "60px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "3px",
            }}
          ></div>
        </div>
      ))}
    </div>
  );
};

export const LeaderboardSectionComponent = (
  props: LeaderboardSectionComponentProps,
) => {
  return (
    <div
      style={{
        marginBottom: "16px",
        background: "rgba(0,0,0,0.3)",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <h3
        style={{
          marginTop: "0",
          marginBottom: "8px",
          fontSize: "16px",
          color: "#fff",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "4px",
        }}
      >
        Level {props.level}
      </h3>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        {props.rows.map((row) => (
          <tr>
            <td
              style={{
                color: row.rankColor,
                width: "40px",
                padding: "4px 0",
              }}
            >
              #{row.rank}
            </td>
            <td
              style={{
                padding: "4px 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "120px",
              }}
            >
              {row.username}
            </td>
            <td
              style={{
                textAlign: "right",
                fontFamily: "monospace",
                padding: "4px 0",
                color: "#4ade80",
              }}
            >
              {row.timeText}
            </td>
          </tr>
        ))}
      </table>
    </div>
  );
};
