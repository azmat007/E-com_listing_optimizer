import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

function cn(...args: Array<string | false | undefined | null>) {
  return args.filter(Boolean).join(" ");
}

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "AI Listing Optimizer — Gulf-Ready Marketplace Listings",
  description:
    "Generate bilingual Amazon, Noon, Carrefour and MicroLess listings with AI, enriched with platform rules, GEO keywords and ready-to-use product images.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={cn(
          openSans.className,
          "min-h-screen antialiased",
          "bg-[#F5F0E6] text-[#2C2416]"
        )}
      >
        <div className="khaleej-gradient-hero">
          <header className="mx-auto max-w-6xl px-6 pt-8 pb-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="khaleej-subtle-text text-sm font-medium">
                  Gulf marketplace listings, automated
                </p>
                <h1 className="text-3xl font-bold tracking-tight">
                  AI Listing Optimizer
                </h1>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <span className="khaleej-badge">Amazon AE/SA</span>
                <span className="khaleej-badge">Noon</span>
                <span className="khaleej-badge">Carrefour</span>
                <span className="khaleej-badge">MicroLess</span>
              </div>
            </div>
            <div className="khaleej-divider mt-6" />
          </header>
        </div>

        <main className="mx-auto max-w-6xl px-6 py-10">
          {children}
        </main>

        <footer className="mx-auto max-w-6xl px-6 pb-12 pt-4">
          <div className="khaleej-divider mb-6" />
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm khaleej-subtle-text">
              AI Listing Optimizer — built for Gulf sellers.
            </p>
            <p className="text-sm khaleej-subtle-text">
              Optimized for Amazon AE/SA, Noon, Carrefour and MicroLess workflows.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
