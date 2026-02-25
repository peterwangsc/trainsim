export type ZooPanelCallbacks = {
  onLevelRebuild: (level: number) => void;
  onTimeChange: (t: number | null) => void; // null = free-running
  onHeadlightToggle: (on: boolean) => void;
  onLock: () => void;
  onUnlock: () => void;
};

export class ZooPanel {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private collapsed = false;
  private frozenT: number | null = null;
  private levelInput!: HTMLInputElement;
  private timeSlider!: HTMLInputElement;
  private timeLabel!: HTMLSpanElement;
  private freezeBtn!: HTMLButtonElement;
  private lockBtn!: HTMLButtonElement;
  private headlightBtn!: HTMLButtonElement;
  private headlightOn = false;

  constructor(container: HTMLElement, private readonly cb: ZooPanelCallbacks) {
    this.root = document.createElement("div");
    this.body = document.createElement("div");
    this.build();
    container.appendChild(this.root);
  }

  setLocked(locked: boolean): void {
    this.lockBtn.textContent = locked ? "Unlock Mouse (Esc)" : "Lock Mouse";
    this.lockBtn.style.background = locked ? "#3a3" : "#444";
  }

  setTimeDisplay(t: number): void {
    if (this.frozenT !== null) return; // slider is controlling; don't override
    this.timeSlider.value = String(t);
    this.timeLabel.textContent = t.toFixed(2);
  }

  dispose(): void {
    this.root.remove();
  }

  private build(): void {
    Object.assign(this.root.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      width: "240px",
      background: "rgba(14, 14, 20, 0.88)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px",
      color: "#e8e8ee",
      fontFamily: "monospace",
      fontSize: "12px",
      userSelect: "none",
      zIndex: "9999",
      backdropFilter: "blur(6px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    });

    // --- header ---
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      cursor: "pointer",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    });

    const title = document.createElement("span");
    title.textContent = "Zoo Debug";
    title.style.fontWeight = "bold";
    title.style.letterSpacing = "0.05em";

    const chevron = document.createElement("span");
    chevron.textContent = "▼";
    chevron.style.fontSize = "10px";
    chevron.style.opacity = "0.6";
    chevron.style.transition = "transform 0.15s";

    header.appendChild(title);
    header.appendChild(chevron);
    header.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.body.style.display = this.collapsed ? "none" : "block";
      chevron.style.transform = this.collapsed ? "rotate(-90deg)" : "";
    });

    // --- body ---
    Object.assign(this.body.style, {
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    });

    this.body.appendChild(this.buildLevelRow());
    this.body.appendChild(this.buildDivider());
    this.body.appendChild(this.buildTimeRow());
    this.body.appendChild(this.buildDivider());
    this.body.appendChild(this.buildHeadlightRow());
    this.body.appendChild(this.buildDivider());
    this.body.appendChild(this.buildMouseRow());

    this.root.appendChild(header);
    this.root.appendChild(this.body);
  }

  private buildLevelRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "6px";

    const label = document.createElement("span");
    label.textContent = "Level";
    label.style.opacity = "0.55";
    label.style.fontSize = "10px";
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = "0.08em";

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "6px";
    controls.style.alignItems = "center";

    this.levelInput = document.createElement("input");
    this.levelInput.type = "number";
    this.levelInput.min = "1";
    this.levelInput.max = "10";
    this.levelInput.value = "1";
    Object.assign(this.levelInput.style, {
      flex: "1",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "4px",
      color: "#e8e8ee",
      padding: "4px 6px",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    const rebuildBtn = document.createElement("button");
    rebuildBtn.textContent = "Rebuild";
    Object.assign(rebuildBtn.style, {
      background: "#2a6",
      border: "none",
      borderRadius: "4px",
      color: "#fff",
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "monospace",
      fontSize: "12px",
    });
    rebuildBtn.addEventListener("click", () => {
      const level = Math.max(
        1,
        Math.min(10, parseInt(this.levelInput.value, 10) || 1),
      );
      this.levelInput.value = String(level);
      this.cb.onLevelRebuild(level);
    });

    controls.appendChild(this.levelInput);
    controls.appendChild(rebuildBtn);
    row.appendChild(label);
    row.appendChild(controls);
    return row;
  }

  private buildTimeRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "6px";

    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.alignItems = "center";

    const label = document.createElement("span");
    label.textContent = "Time of Day";
    label.style.opacity = "0.55";
    label.style.fontSize = "10px";
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = "0.08em";

    this.timeLabel = document.createElement("span");
    this.timeLabel.textContent = "—";
    this.timeLabel.style.opacity = "0.8";

    labelRow.appendChild(label);
    labelRow.appendChild(this.timeLabel);

    this.timeSlider = document.createElement("input");
    this.timeSlider.type = "range";
    this.timeSlider.min = "0";
    this.timeSlider.max = "1";
    this.timeSlider.step = "0.001";
    this.timeSlider.value = "0.5";
    Object.assign(this.timeSlider.style, {
      width: "100%",
      accentColor: "#f8b44c",
      cursor: "pointer",
    });
    this.timeSlider.addEventListener("input", () => {
      const t = parseFloat(this.timeSlider.value);
      this.timeLabel.textContent = t.toFixed(2);
      if (this.frozenT !== null) {
        this.frozenT = t;
        this.cb.onTimeChange(t);
      }
    });

    this.freezeBtn = document.createElement("button");
    this.freezeBtn.textContent = "⏸ Freeze Time";
    Object.assign(this.freezeBtn.style, {
      background: "#444",
      border: "none",
      borderRadius: "4px",
      color: "#fff",
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "monospace",
      fontSize: "12px",
      width: "100%",
    });
    this.freezeBtn.addEventListener("click", () => {
      if (this.frozenT === null) {
        // freeze: read current slider value
        this.frozenT = parseFloat(this.timeSlider.value);
        this.cb.onTimeChange(this.frozenT);
        this.freezeBtn.textContent = "▶ Resume Time";
        this.freezeBtn.style.background = "#a63";
      } else {
        this.frozenT = null;
        this.cb.onTimeChange(null);
        this.freezeBtn.textContent = "⏸ Freeze Time";
        this.freezeBtn.style.background = "#444";
      }
    });

    row.appendChild(labelRow);
    row.appendChild(this.timeSlider);
    row.appendChild(this.freezeBtn);
    return row;
  }

  private buildHeadlightRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "6px";

    this.headlightBtn = document.createElement("button");
    this.headlightBtn.textContent = "💡 Headlight: OFF";
    Object.assign(this.headlightBtn.style, {
      background: "#444",
      border: "none",
      borderRadius: "4px",
      color: "#fff",
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "monospace",
      fontSize: "12px",
      width: "100%",
      textAlign: "left",
    });
    this.headlightBtn.addEventListener("click", () => {
      this.headlightOn = !this.headlightOn;
      this.headlightBtn.textContent = this.headlightOn
        ? "💡 Headlight: ON"
        : "💡 Headlight: OFF";
      this.headlightBtn.style.background = this.headlightOn ? "#885500" : "#444";
      this.cb.onHeadlightToggle(this.headlightOn);
    });

    row.appendChild(this.headlightBtn);
    return row;
  }

  private buildMouseRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "6px";

    const hint = document.createElement("div");
    hint.style.opacity = "0.45";
    hint.style.fontSize = "10px";
    hint.style.lineHeight = "1.5";
    hint.innerHTML =
      "WASD — move &nbsp; Q — down &nbsp; Space — up<br>Shift — fast &nbsp; Click canvas to lock";

    this.lockBtn = document.createElement("button");
    this.lockBtn.textContent = "Lock Mouse";
    Object.assign(this.lockBtn.style, {
      background: "#444",
      border: "none",
      borderRadius: "4px",
      color: "#fff",
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "monospace",
      fontSize: "12px",
      width: "100%",
    });
    this.lockBtn.addEventListener("click", () => {
      if (document.pointerLockElement) {
        this.cb.onUnlock();
      } else {
        this.cb.onLock();
      }
    });

    row.appendChild(hint);
    row.appendChild(this.lockBtn);
    return row;
  }

  private buildDivider(): HTMLElement {
    const div = document.createElement("div");
    div.style.borderTop = "1px solid rgba(255,255,255,0.08)";
    div.style.margin = "0 -2px";
    return div;
  }
}
