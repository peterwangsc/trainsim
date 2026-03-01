type LoginScreenComponentProps = {
  username: string | null;
  isLoginDisabled: boolean;
  logoutLabel: string;
  onOverlayClick: (event: MouseEvent) => void;
  onUsernameInput: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
};

export const LoginScreenComponent = (props: LoginScreenComponentProps) => {
  const loginButtonClass = props.isLoginDisabled
    ? "login-screen__login-button login-screen__login-button--disabled"
    : "login-screen__login-button";

  return (
    <div class="login-screen login-screen--hidden" onclick={props.onOverlayClick}>
      <div class="login-screen__card">
        <div class="login-screen__login-field">
          <input
            id="login-screen-username-input"
            type="text"
            placeholder="Username (Optional)"
            class="login-screen__username-input"
            value={props.username ?? ""}
            oninput={props.onUsernameInput}
          />
          <button
            id="login-screen-login-button"
            type="button"
            class={loginButtonClass}
            onclick={props.onLoginClick}
          >
            Login
          </button>
        </div>

        <button
          id="login-screen-logout-button"
          type="button"
          class="login-screen__logout-button"
          onclick={props.onLogoutClick}
        >
          {props.logoutLabel}
        </button>
      </div>
    </div>
  );
};
