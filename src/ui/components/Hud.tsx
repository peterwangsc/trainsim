import { GameState, GameStatus } from "@/game/GameState";

type HudComponentProps = {
  gameState: GameState;
  onBrakePointerDown: (event: PointerEvent) => void;
  onBrakeTouchStart: (event: TouchEvent) => void;
  onUsernameClick: () => void;
  onSettingsClick: () => void;
};

export const HudComponent = (props: HudComponentProps) => {
  return (
    <div class="hud">
      <div class="hud-status-banner">
        Drive to the terminal station and stop before the platform ends.
      </div>
      
      <div class="hud-preview-cluster">
        {/* We will leave a placeholder for the canvas to be mounted later. */}
        <div id="minimap-container"></div>
        <p class="hud-speed hud-speed-floating">
          <span class="hud-speed-value" id="hud-speed-value">0</span>
          <span class="hud-speed-unit">kph</span>
        </p>
      </div>

      <div class="speed-limit-sign">
        <span class="speed-limit-label">Speed Limit</span>
        <span class="speed-limit-value" id="hud-speed-limit-value">0</span>
        <span class="speed-limit-unit">kph</span>
      </div>

      <div class="hud-time-cluster">
        <span class="hud-time-label">Time</span>
        <span class="hud-time-value" id="hud-clock-value"></span>
        <span class="hud-time-label hud-time-label--eta">ETA</span>
        <span class="hud-time-value hud-time-value--eta" id="hud-eta-value"></span>
      </div>

      <div class="comfort-gauge" id="hud-comfort-gauge">
        <span class="comfort-gauge-label">Comfort</span>
        <div class="comfort-gauge-track">
          <div class="comfort-gauge-fill" id="hud-comfort-fill"></div>
        </div>
        <span class="comfort-gauge-value" id="hud-comfort-value">100%</span>
      </div>

      <button
        type="button"
        class="brake-button"
        id="hud-brake-button"
        onpointerdown={props.onBrakePointerDown}
      >
        STOP
      </button>

      <div class="username-display" id="hud-username-display" onclick={props.onUsernameClick}>
        {props.gameState.username ?? "Login"}
      </div>

      <button class="hud-settings-btn" type="button" onclick={props.onSettingsClick}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  );
};
