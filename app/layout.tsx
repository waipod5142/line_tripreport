import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-thai",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LINE Trip Intelligence",
  description:
    "Turn LINE transport conversations into a traceable, reviewable trip database.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${plexSans.variable} ${plexThai.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
