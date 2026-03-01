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
  metadataBase: new URL("https://gitschema.vercel.app"),
  title: {
    default: "GitSchema — Visualize Any GitHub Repository",
    template: "%s | GitSchema",
  },
  description:
    "Paste a GitHub URL and get an interactive visual map of the repository architecture, file dependencies, and API flow. The fastest way to understand any codebase.",
  keywords: [
    "GitSchema",
    "Gitschema",
    "GitHub visualizer",
    "repository architecture diagram",
    "codebase map",
    "file dependencies visualizer",
    "API flow visualization",
    "visualize github repo",
    "understand codebase",
  ],
  authors: [{ name: "GitSchema" }],
  creator: "GitSchema",
  publisher: "GitSchema",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "GitSchema — Visualize Any GitHub Repository",
    description:
      "Paste a GitHub URL and get an interactive visual map of the repository architecture, file dependencies, and API flow.",
    url: "https://gitschema.up.railway.app",
    siteName: "GitSchema",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitSchema — Visualize Any GitHub Repository",
    description:
      "Paste a GitHub URL and get an interactive visual map of the repository architecture, file dependencies, and API flow.",
    creator: "@gitschema",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://gitschema.up.railway.app",
  },
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/favicon/site.webmanifest",
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
