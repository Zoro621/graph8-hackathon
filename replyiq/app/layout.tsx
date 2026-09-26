import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { envStatus } from "@/lib/env";
import Providers from "@/components/shell/Providers";
import TopBar from "@/components/shell/TopBar";
import CommandPalette from "@/components/shell/CommandPalette";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "ReplyIQ",
  description: "Reply intelligence for graph8: every reply becomes the next campaign.",
};

export const viewport: Viewport = { themeColor: "#05060a" };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const env = envStatus();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}>
      <body className="relative min-h-full">
        <div className="aurora" aria-hidden />
        <div className="grid-floor" aria-hidden />
        <div className="grain" aria-hidden />
        <Providers>
          <div className="relative z-10 flex min-h-screen flex-col">
            <TopBar env={env} />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
