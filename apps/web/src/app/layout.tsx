import type { Metadata } from "next";
import type { ReactNode } from "react";
import { geist, geistMono, instrumentSerif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thema: taste, exported",
  description:
    "Blend the sites you love into one original, accessible design system your AI coding agent follows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
