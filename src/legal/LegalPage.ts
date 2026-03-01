export class LegalPage {
  constructor(container: HTMLElement, title: string, sections: LegalSection[]) {
    // Undo game CSS that locks the viewport
    const docEl = document.documentElement;
    docEl.style.height = "auto";
    docEl.style.overflowY = "auto";
    document.body.style.height = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.userSelect = "text";
    document.body.style.webkitUserSelect = "text";
    // #app is position:fixed in the game; make it a normal block for legal pages
    container.style.position = "static";
    container.style.width = "100%";
    container.style.height = "auto";
    document.title = `${title} — TrainSim`;

    const root = document.createElement("div");
    root.className = "legal-page";

    root.innerHTML = `
      <style>
        .legal-page {
          min-height: 100vh;
          background: var(--bg-void);
          color: var(--text-primary);
          font-family: var(--font-ui);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .legal-nav {
          width: 100%;
          max-width: 800px;
          padding: 20px 24px 0;
        }
        .legal-nav a {
          color: var(--accent-blue);
          text-decoration: none;
          font-size: 0.9rem;
          letter-spacing: 0.04em;
          opacity: 0.85;
          transition: opacity 0.15s;
        }
        .legal-nav a:hover { opacity: 1; }
        .legal-card {
          width: 100%;
          max-width: 800px;
          margin: 24px 0 60px;
          padding: 40px 48px;
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
        }
        @media (max-width: 640px) {
          .legal-card { padding: 28px 20px; margin: 16px 12px 48px; width: calc(100% - 24px); }
        }
        .legal-card h1 {
          margin: 0 0 6px;
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-bright);
          letter-spacing: 0.02em;
        }
        .legal-date {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin-bottom: 36px;
          display: block;
        }
        .legal-card h2 {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--accent-blue);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 32px 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border-dim);
        }
        .legal-card p, .legal-card li {
          font-size: 0.97rem;
          line-height: 1.75;
          color: var(--text-primary);
          margin: 0 0 12px;
        }
        .legal-card ul {
          margin: 0 0 12px;
          padding-left: 22px;
        }
        .legal-card a {
          color: var(--accent-blue);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .legal-card a:hover { opacity: 0.85; }
        .legal-footer {
          width: 100%;
          max-width: 800px;
          padding: 0 24px 40px;
          font-size: 0.82rem;
          color: var(--text-muted);
          display: flex;
          gap: 16px;
        }
        .legal-footer a {
          color: var(--text-muted);
          text-decoration: none;
        }
        .legal-footer a:hover { color: var(--text-primary); }
      </style>

      <nav class="legal-nav">
        <a href="/">&larr; Back to TrainSim</a>
      </nav>

      <main class="legal-card">
        <h1>${title}</h1>
        <span class="legal-date">Effective: March 1, 2026</span>
        ${sections.map((s) => renderSection(s)).join("")}
      </main>

      <footer class="legal-footer">
        <a href="/policy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/">TrainSim.io</a>
      </footer>
    `;

    container.appendChild(root);
  }
}

type LegalSection = { heading: string; body: string };

function renderSection(s: LegalSection): string {
  return `<h2>${s.heading}</h2>${s.body}`;
}
