import { LegalPage } from "./LegalPage";

export class PolicyPage {
  constructor(container: HTMLElement) {
    new LegalPage(container, "Privacy Policy", [
      {
        heading: "Overview",
        body: `<p>TrainSim ("we", "us", or "our") is a browser-based 3D train driving simulator available at <a href="https://trainsim.io">trainsim.io</a>. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information. By using TrainSim you agree to the practices described here.</p>`,
      },
      {
        heading: "Information We Collect",
        body: `
          <p><strong>Username.</strong> Providing a username is entirely optional. If you choose to enter one, it is stored in our database (Supabase) and displayed on the leaderboard alongside your run times.</p>
          <p><strong>Completion times.</strong> When you finish a run, your completion time and the associated level number are recorded in our database so they can appear on the leaderboard. This record is linked to a randomly generated anonymous identifier (UUID), not to any account or personal information unless you have also entered a username.</p>
          <p><strong>Analytics.</strong> We use <a href="https://vercel.com/analytics" target="_blank" rel="noopener">Vercel Analytics</a> to collect anonymous, aggregated usage data such as page views and general geographic region. Vercel Analytics does not use cookies or fingerprinting and does not identify individual visitors. See <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener">Vercel's privacy documentation</a> for details.</p>
          <p><strong>What we do not collect.</strong> We do not collect email addresses, passwords, payment information, device identifiers, or any other personally identifying information beyond an optional username you voluntarily provide.</p>
        `,
      },
      {
        heading: "How We Use Your Information",
        body: `
          <ul>
            <li>To display leaderboard rankings and personal best times during gameplay.</li>
            <li>To remember your volume preferences between sessions (stored locally in your browser via <code>localStorage</code>).</li>
            <li>To understand aggregate usage patterns and improve the game.</li>
          </ul>
          <p>We do not sell, rent, or share your information with third parties for advertising or marketing purposes.</p>
        `,
      },
      {
        heading: "Data Storage",
        body: `<p>Usernames and run times are stored in a Supabase PostgreSQL database hosted on cloud infrastructure in the United States. Volume preferences are stored only in your browser's <code>localStorage</code> and never sent to our servers.</p>`,
      },
      {
        heading: "Data Retention and Deletion",
        body: `<p>Run time records and usernames are retained indefinitely to support the leaderboard. If you wish to have your data removed, please contact us at <a href="mailto:privacy@trainsim.io">privacy@trainsim.io</a> with the username you used, and we will delete the associated records within 30 days.</p>`,
      },
      {
        heading: "Cookies",
        body: `<p>TrainSim does not use cookies for tracking or advertising. A session identifier may be stored in <code>localStorage</code> to persist your anonymous player record across visits.</p>`,
      },
      {
        heading: "Children's Privacy",
        body: `<p>TrainSim is a general-audience game. We do not knowingly collect personal information from children under 13. If you believe a child has provided a username through our service, please contact us and we will remove it promptly.</p>`,
      },
      {
        heading: "Changes to This Policy",
        body: `<p>We may update this Privacy Policy from time to time. The "Effective" date at the top of this page reflects when the current version took effect. Continued use of TrainSim after changes constitutes acceptance of the revised policy.</p>`,
      },
      {
        heading: "Contact",
        body: `<p>Questions or concerns about this policy can be directed to <a href="mailto:privacy@trainsim.io">privacy@trainsim.io</a>.</p>`,
      },
    ]);
  }
}
