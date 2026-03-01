import { LegalPage } from "./LegalPage";

export class TermsPage {
  constructor(container: HTMLElement) {
    new LegalPage(container, "Terms of Service", [
      {
        heading: "Acceptance of Terms",
        body: `<p>By accessing or using TrainSim at <a href="https://trainsim.io">trainsim.io</a> ("the Game"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Game. We reserve the right to update these Terms at any time; the "Effective" date above reflects the latest revision.</p>`,
      },
      {
        heading: "Use of the Game",
        body: `
          <p>TrainSim is a free, browser-based game provided for personal, non-commercial entertainment. You may play the Game on any device with a compatible web browser without creating an account.</p>
          <p>You agree not to:</p>
          <ul>
            <li>Attempt to cheat, exploit bugs, or manipulate the leaderboard.</li>
            <li>Reverse engineer, decompile, or extract the game's source code or assets for redistribution.</li>
            <li>Use automated tools, bots, or scripts to interact with the Game or its backend services.</li>
            <li>Interfere with or disrupt the servers or infrastructure that run the Game.</li>
            <li>Use the Game in any way that violates applicable law.</li>
          </ul>
        `,
      },
      {
        heading: "Username and Leaderboard",
        body: `
          <p>Entering a username is optional. If you choose to submit a username, you represent that it does not infringe any third-party rights and does not contain offensive, hateful, or unlawful content. We reserve the right to remove or modify any username at our sole discretion without notice.</p>
          <p>Leaderboard times that are physically impossible or otherwise fraudulent may be removed. We make the final determination on what constitutes a valid run.</p>
        `,
      },
      {
        heading: "Intellectual Property",
        body: `<p>All game code, art, audio, and other content are owned by or licensed to TrainSim. Nothing in these Terms grants you any right, title, or interest in the Game or its content beyond the limited right to play it in your browser for personal use.</p>`,
      },
      {
        heading: "Disclaimer of Warranties",
        body: `<p>THE GAME IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE GAME WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.</p>`,
      },
      {
        heading: "Limitation of Liability",
        body: `<p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL TRAINSIM OR ITS OPERATORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE GAME, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE GAME SHALL NOT EXCEED ZERO DOLLARS, AS THE GAME IS PROVIDED FREE OF CHARGE.</p>`,
      },
      {
        heading: "Third-Party Services",
        body: `<p>The Game uses third-party services including Supabase (database), Vercel (hosting and analytics), and cloud-hosted audio/texture assets. Your use of the Game is subject to the relevant terms and privacy policies of those providers. We are not responsible for the practices of third-party services.</p>`,
      },
      {
        heading: "Termination",
        body: `<p>We reserve the right to suspend or terminate access to the Game at any time, for any reason, without notice. All provisions of these Terms that by their nature should survive termination (including warranty disclaimers and limitations of liability) will survive.</p>`,
      },
      {
        heading: "Governing Law",
        body: `<p>These Terms are governed by and construed in accordance with the laws of the United States, without regard to conflict-of-law principles. Any disputes arising under these Terms shall be resolved in the courts of competent jurisdiction in the United States.</p>`,
      },
      {
        heading: "Contact",
        body: `<p>Questions about these Terms can be directed to <a href="mailto:legal@trainsim.io">legal@trainsim.io</a>.</p>`,
      },
    ]);
  }
}
