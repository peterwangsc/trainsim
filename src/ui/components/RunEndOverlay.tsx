type RunEndOverlayComponentProps = {
  onPrimaryActionClick: () => void;
  onReplayClick: () => void;
  onLoginInput: () => void;
  onLoginClick: () => void;
};

export const RunEndOverlayComponent = (props: RunEndOverlayComponentProps) => {
  return (
    <div class="run-end-overlay run-end-overlay--hidden">
      <div class="run-end-overlay__card">
        <h2 id="run-end-overlay-title" class="run-end-overlay__title"></h2>
        <p id="run-end-overlay-message" class="run-end-overlay__message"></p>

        <div
          id="run-end-overlay-stats"
          class="run-end-overlay__stats"
          style={{
            display: "none",
            flexDirection: "column",
            gap: "8px",
            marginTop: "16px",
            marginBottom: "16px",
            padding: "16px",
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            width: "100%",
          }}
        >
          <div
            id="run-end-overlay-time"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          ></div>
          <div
            id="run-end-overlay-pb"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "#aaa",
            }}
          ></div>
          <div
            id="run-end-overlay-record"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "#aaa",
            }}
          ></div>
        </div>

        <div class="run-end-overlay__actions">
          <button
            id="run-end-overlay-replay"
            type="button"
            class="run-end-overlay__button run-end-overlay__button--secondary"
            onclick={props.onReplayClick}
          >
            <span class="run-end-overlay__button-icon run-end-overlay__button-icon--left" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="5" x2="6" y2="19"></line>
                <path d="M18 6l-10 6 10 6V6z"></path>
              </svg>
            </span>
            <span id="run-end-overlay-replay-label">Replay</span>
          </button>

          <button
            id="run-end-overlay-restart"
            type="button"
            class="run-end-overlay__button run-end-overlay__button--primary"
            onclick={props.onPrimaryActionClick}
          >
            <span id="run-end-overlay-primary-label">Restart</span>
            <span class="run-end-overlay__button-icon run-end-overlay__button-icon--right" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 6l10 6-10 6V6z"></path>
                <line x1="18" y1="5" x2="18" y2="19"></line>
              </svg>
            </span>
          </button>
        </div>

        <div
          id="run-end-overlay-auth"
          class="login-screen__login-field"
          style={{
            marginTop: "20px",
            flexDirection: "column",
            gap: "8px",
            display: "none",
          }}
        >
          <input
            id="run-end-overlay-login-input"
            type="text"
            placeholder="Username (Optional)"
            class="login-screen__username-input"
            oninput={props.onLoginInput}
          />
          <button
            id="run-end-overlay-login-button"
            type="button"
            class="login-screen__login-button login-screen__login-button--disabled"
            onclick={props.onLoginClick}
          >
            Log In to Save Progress
          </button>
        </div>
      </div>
    </div>
  );
};
