import { VolumeSliderComponent } from "@/ui/components/VolumeSlider";

type SettingsScreenComponentProps = {
  onOverlayClick: (event: MouseEvent) => void;
  onCardClick: (event: MouseEvent) => void;
  onLoadClick: () => void;
  onCancelClick: () => void;
};

export const SettingsScreenComponent = (props: SettingsScreenComponentProps) => {
  return (
    <div class="login-screen login-screen--hidden" onclick={props.onOverlayClick}>
      <div
        class="settings-panel settings-panel--compact"
        style={{
          maxWidth: "800px",
          width: "min(92vw, 800px)",
          height: "auto",
          margin: "auto",
        }}
        onclick={props.onCardClick}
      >
        <div class="settings-panel__content">
          <div class="settings-panel__section">
            <h3>Audio Mix</h3>
            <div class="throttle-sliders">
              <VolumeSliderComponent id="ingame-master-volume" label="Master" />
              <VolumeSliderComponent id="ingame-music-volume" label="Music" />
              <VolumeSliderComponent id="ingame-sfx-volume" label="SFX" />
            </div>
          </div>

          <div class="settings-panel__section">
            <h3>Level Selection</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              <select
                id="ingame-level-select"
                style={{
                  width: "200px",
                  padding: "10px",
                  borderRadius: "4px",
                  fontSize: "16px",
                  backgroundColor: "#222",
                  color: "#fff",
                  border: "1px solid #444",
                }}
              ></select>

              <button
                id="ingame-load-level-btn"
                class="run-end-overlay__restart"
                type="button"
                style={{
                  margin: "0",
                  padding: "10px 0",
                  fontSize: "14px",
                  width: "200px",
                }}
                onclick={props.onLoadClick}
              >
                Load Level
              </button>

              <button
                id="ingame-close-settings-btn"
                class="login-screen__logout-button"
                type="button"
                style={{
                  margin: "0",
                  padding: "10px 0",
                  fontSize: "14px",
                  width: "200px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
                onclick={props.onCancelClick}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
