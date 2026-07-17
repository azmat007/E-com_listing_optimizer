import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

function cn(...args: Array<string | false | undefined | null>) {
  return args.filter(Boolean).join(" ");
}

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "LISTFORGE_AI — Gulf-Ready Marketplace Listings",
  description:
    "Generate bilingual Amazon, Noon, Carrefour and MicroLess listings with AI, enriched with platform rules, GEO keywords and ready-to-use product images.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={cn(
          spaceGrotesk.variable,
          jetbrainsMono.variable,
          "min-h-screen antialiased relative overflow-x-hidden"
        )}
      >
        <div className="lf-grid-texture" />
        <div className="lf-glow-blob" />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
