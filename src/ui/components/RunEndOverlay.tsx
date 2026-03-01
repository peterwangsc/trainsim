type RunEndOverlayComponentProps = {
  onRestartClick: () => void;
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

        <button
          id="run-end-overlay-restart"
          type="button"
          class="run-end-overlay__restart"
          onclick={props.onRestartClick}
        >
          Restart
        </button>

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
