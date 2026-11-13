import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

// Self-hosted at build time (no runtime requests to Google). The CSS variables are what
// tokens.generated.css and globals.css point the font roles at (FONT_VARIABLES in scripts/tokens.ts).
export const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});
