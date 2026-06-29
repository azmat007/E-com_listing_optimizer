import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

function cn(...args: Array<string | false | undefined | null>) {
  return args.filter(Boolean).join(" ");
}

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "AI Listing Optimizer",
  description: "Generate optimized Amazon and Noon product listings with AI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={cn(openSans.className, "min-h-screen bg-white text-zinc-900 antialiased")}>
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </body>
    </html>
  );
}
