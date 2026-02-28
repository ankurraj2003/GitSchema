import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitSchema — Visualize Any GitHub Repository",
  description:
    "Paste a GitHub URL and get an interactive visual map of the repository architecture, file dependencies, and API flow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {/* Cyber-grid background */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Grid lines */}
          <div
            className="absolute inset-0 animate-grid-drift"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.82 0.16 195 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.82 0.16 195 / 0.06) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
          {/* Glow orbs */}
          <div
            className="absolute inset-0 animate-glow-pulse"
            style={{
              background:
                "radial-gradient(ellipse 600px 400px at 20% 30%, oklch(0.65 0.25 300 / 0.08), transparent), radial-gradient(ellipse 500px 350px at 80% 70%, oklch(0.82 0.16 195 / 0.06), transparent), radial-gradient(ellipse 400px 300px at 50% 50%, oklch(0.6 0.2 260 / 0.05), transparent)",
            }}
          />
        </div>

        {/* Scanline overlay */}
        <div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0 0 0 / 0.03) 2px, oklch(0 0 0 / 0.03) 4px)",
          }}
        />

        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
