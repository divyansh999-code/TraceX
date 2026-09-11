import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

/**
 * Typography — chosen for a crafted, editorial precision:
 *  · Fraunces      — display serif with optical sizing (soft, humanist detail)
 *  · Hanken Grotesk— UI grotesque (quiet, precise, excellent at small sizes)
 *  · Spline Sans Mono — data readouts (tabular, technical but warm)
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TraceX — Social Intelligence Console",
  description:
    "TraceX unifies X (Twitter) and Telegram signals into a single analyst console: trends, sentiment, demographics, network influence, bot detection and misinformation radar.",
  keywords: [
    "TraceX",
    "social media analytics",
    "OSINT",
    "misinformation detection",
    "bot detection",
  ],
  icons: {
    icon: "/tracex-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${hankenGrotesk.variable} ${splineSansMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
