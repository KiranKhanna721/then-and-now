import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Then & Now",
  description:
    "Reminiscence sessions for people living with dementia, built from the culture of their own youth with Qloo's taste graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <header className="topbar">
          <div className="wrap">
            <Link href="/" className="brand">
              Then <span>&amp;</span> Now
            </Link>
            <span className="muted small">Reminiscence sessions, grounded in real taste</span>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer>
          <div className="wrap">
            Then &amp; Now is a comfort activity, not medical care. Profiles are stored only in this browser; use first
            names only. Cultural data from Qloo; planning by Claude.
          </div>
        </footer>
      </body>
    </html>
  );
}
