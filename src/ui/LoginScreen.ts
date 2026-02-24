import { ASSETS_CDN_BASE } from "../game/Config";

export class LoginScreen {
  private readonly root: HTMLDivElement;
  private readonly usernameInput: HTMLInputElement | null = null;
  constructor(
    container: HTMLElement,
    private readonly onLogin?: (
      username: string,
      targetLevel?: number | undefined,
    ) => void,
    private readonly onLogout?: () => void,
    private currentUsername: string | null = null,
    private targetLevel?: number | undefined,
  ) {
    this.onLogin = onLogin;
    this.onLogout = onLogout;
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
    if (this.currentUsername) {
      this.usernameInput.value = this.currentUsername;
    }

    const loginButton = document.createElement("button");
    loginButton.type = "button";
    loginButton.className = "login-screen__login-button";
    if (
      !this.currentUsername ||
      this.currentUsername.trim() === "" ||
      this.currentUsername === this.usernameInput?.value
    ) {
      loginButton.classList.add("login-screen__login-button--disabled");
    }
    loginButton.textContent = "Login";
    loginButton.addEventListener("click", () => {
      if (
        this.usernameInput?.value &&
        this.usernameInput.value.trim() !== this.currentUsername
      ) {
        this.onLogin?.(this.usernameInput.value.trim(), this.targetLevel);
        this.hide();
      }
    });

    this.usernameInput.addEventListener("input", () => {
      if (
        this.usernameInput?.value &&
        this.usernameInput.value.trim() !== this.currentUsername
      ) {
        loginButton.classList.remove("login-screen__login-button--disabled");
      } else {
        loginButton.classList.add("login-screen__login-button--disabled");
      }
    });

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "login-screen__logout-button";
    logoutButton.textContent = this.currentUsername ? "Logout" : "Cancel";
    logoutButton.addEventListener("click", () => {
      this.onLogout?.();
      this.currentUsername = null;
      this.targetLevel = undefined;
      this.hide();
    });

    const loginField = document.createElement("div");
    loginField.className = "login-screen__login-field";
    loginField.appendChild(this.usernameInput);
    loginField.appendChild(loginButton);

    card.append(loginField, logoutButton);
    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  show(): void {
    this.root.classList.remove("login-screen--hidden");
    this.root.classList.add("login-screen--visible");
  }

  hide(): void {
    this.root.classList.remove("login-screen--visible");
    this.root.classList.add("login-screen--hidden");
  }
}
