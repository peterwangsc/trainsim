import { GameState } from "@/game/GameState";
import { LoginScreenComponent } from "@/ui/components/LoginScreen";
import { login, logout } from "@/util/Username";

export class LoginScreen {
  private readonly root: HTMLDivElement;
  private readonly usernameInput: HTMLInputElement;
  private readonly onStart: (
    level: number,
    userId: string,
    username: string | null,
  ) => void;
  private readonly gameState: GameState;
  private readonly logoutButton: HTMLButtonElement;
  private readonly loginButton: HTMLButtonElement;

  private readonly handleOverlayClickBound: (event: MouseEvent) => void;
  private readonly handleUsernameInputBound: () => void;
  private readonly handleLoginClickBound: () => void;
  private readonly handleLogoutClickBound: () => void;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    onStart: (level: number, userId: string, username: string | null) => void,
  ) {
    this.onStart = onStart;
    this.gameState = gameState;

    this.handleOverlayClickBound = this.handleOverlayClick.bind(this);
    this.handleUsernameInputBound = this.handleUsernameInput.bind(this);
    this.handleLoginClickBound = this.handleLoginClick.bind(this);
    this.handleLogoutClickBound = this.handleLogoutClick.bind(this);

    const isLoginDisabled =
      !this.gameState.username || this.gameState.username.trim() === "";

    this.root = LoginScreenComponent({
      username: this.gameState.username,
      isLoginDisabled,
      logoutLabel: this.gameState.username ? "Logout" : "Cancel",
      onOverlayClick: this.handleOverlayClickBound,
      onUsernameInput: this.handleUsernameInputBound,
      onLoginClick: this.handleLoginClickBound,
      onLogoutClick: this.handleLogoutClickBound,
    });

    this.usernameInput = this.root.querySelector(
      "#login-screen-username-input",
    ) as HTMLInputElement;
    this.loginButton = this.root.querySelector(
      "#login-screen-login-button",
    ) as HTMLButtonElement;
    this.logoutButton = this.root.querySelector(
      "#login-screen-logout-button",
    ) as HTMLButtonElement;

    container.appendChild(this.root);
    this.updateLoginButtonState(this.loginButton);
  }

  public reset(): void {
    this.usernameInput.value = this.gameState.username || "";
    this.logoutButton.textContent = this.gameState.username ? "Logout" : "Cancel";
    this.updateLoginButtonState(this.loginButton);
  }

  public dispose(): void {
    this.root.remove();
  }

  public show(): void {
    this.root.classList.remove("login-screen--hidden");
    this.root.classList.add("login-screen--visible");
  }

  public hide(): void {
    this.root.classList.remove("login-screen--visible");
    this.root.classList.add("login-screen--hidden");
  }

  private handleOverlayClick(event: MouseEvent): void {
    if (event.target === this.root) {
      this.hide();
    }
  }

  private handleUsernameInput(): void {
    this.updateLoginButtonState(this.loginButton);
  }

  private handleLoginClick(): void {
    this.handleLogin(this.loginButton);
  }

  private handleLogoutClick(): void {
    this.handleLogout();
  }

  private handleLogin(button: HTMLButtonElement): void {
    const username = this.usernameInput.value.trim();
    if (username && username !== this.gameState.username) {
      button.disabled = true;
      button.textContent = "Logging in...";
      button.classList.add("login-screen__login-button--disabled");
      login(username, this.gameState)
        .then((result) => {
          if (result) {
            this.gameState.update({
              userId: result.userId,
              username: result.username,
              level: result.level,
              maxLevel: result.level,
            });
            this.hide();
            this.onStart(result.level, result.userId, result.username);
            button.disabled = false;
            button.textContent = "Login";
            this.logoutButton.textContent = "Logout";
          } else {
            button.disabled = false;
            button.textContent = "Error. Try again";
            button.classList.remove("login-screen__login-button--disabled");
          }
        })
        .catch((error) => {
          console.log("failed to login", error);
          console.error("Failed to login", error);
          button.disabled = false;
          button.textContent = "Error. Try again";
          button.classList.remove("login-screen__login-button--disabled");
        });
    }
  }

  private handleLogout(): void {
    if (this.logoutButton.textContent === "Cancel") {
      this.hide();
      return;
    }
    logout()
      .then((result) => {
        this.gameState.update({
          userId: result.userId,
          level: result.level,
          maxLevel: result.level,
          username: null,
        });
        this.hide();
        this.onStart(result.level, result.userId, null);
      })
      .catch((error) => {
        console.error("Failed to logout", error);
      })
      .finally(() => {
        this.hide();
      });
  }

  private updateLoginButtonState(button: HTMLButtonElement): void {
    const username = this.usernameInput.value.trim();
    const canLogin = username && username !== this.gameState.username;
    button.classList.toggle("login-screen__login-button--disabled", !canLogin);
  }
}
