import type { Metadata } from "next";
// Self-hosted font files (no runtime network fetch to Google's font CDN —
// see app/globals.css for how these map to the --font-display/--font-sans/
// --font-mono variables the rest of the app already uses via
// tailwind.config.ts). Newsreader / Inter / IBM Plex Mono, same pairing
// as before, just bundled at build time instead of fetched remotely.
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/newsreader/600-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewLab — Prepare for the interview you actually want",
  description:
    "Personalized AI interview practice: real questions for your role, honest feedback on your answers, and a record of how you're improving.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
