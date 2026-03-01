import { GameState } from "@/game/GameState";
import { login, logout } from "@/util/Username";

export class LoginScreen {
  private readonly root: HTMLDivElement;
  private readonly usernameInput: HTMLInputElement | null = null;
  private readonly onStart: (
    level: number,
    userId: string,
    username: string | null,
  ) => void;
  private readonly gameState: GameState;
  private logoutButton: HTMLButtonElement | null = null;
  private loginButton: HTMLButtonElement | null = null;

  constructor(
    container: HTMLElement,
    gameState: GameState,
    onStart: (level: number, userId: string, username: string | null) => void,
  ) {
    this.onStart = onStart;
    this.gameState = gameState;
    this.root = document.createElement("div");
    this.root.className = "login-screen login-screen--hidden";
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.hide();
      }
    });

    const card = document.createElement("div");
    card.className = "login-screen__card";

    this.usernameInput = document.createElement("input");
    this.usernameInput.type = "text";
    this.usernameInput.placeholder = "Username (Optional)";
    this.usernameInput.className = "login-screen__username-input";
    if (this.gameState.username) {
      this.usernameInput.value = this.gameState.username;
    }

    const loginButton = document.createElement("button");
    loginButton.type = "button";
    loginButton.className = "login-screen__login-button";
    if (
      !this.gameState.username ||
      this.gameState.username.trim() === "" ||
      this.gameState.username === this.usernameInput?.value
    ) {
      loginButton.classList.add("login-screen__login-button--disabled");
    }
    loginButton.textContent = "Login";
    loginButton.addEventListener("click", () => this.handleLogin(loginButton));
    this.loginButton = loginButton;

    this.usernameInput.addEventListener("input", () =>
      this.updateLoginButtonState(loginButton),
    );

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "login-screen__logout-button";
    logoutButton.textContent = this.gameState.username ? "Logout" : "Cancel";
    logoutButton.addEventListener("click", () => this.handleLogout());
    this.logoutButton = logoutButton;

    const loginField = document.createElement("div");
    loginField.className = "login-screen__login-field";
    loginField.appendChild(this.usernameInput);
    loginField.appendChild(loginButton);

    card.append(loginField, logoutButton);
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  public reset(): void {
    this.usernameInput!.value = this.gameState.username || "";
    this.logoutButton!.textContent = this.gameState.username
      ? "Logout"
      : "Cancel";
    this.updateLoginButtonState(this.loginButton!);
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

  private handleLogin(button: HTMLButtonElement): void {
    const username = this.usernameInput?.value?.trim();
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
            this.logoutButton!.textContent = "Logout";
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
    if (this.logoutButton!.textContent === "Cancel") {
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
    const username = this.usernameInput?.value?.trim();
    const canLogin = username && username !== this.gameState.username;
    button.classList.toggle("login-screen__login-button--disabled", !canLogin);
  }
}
