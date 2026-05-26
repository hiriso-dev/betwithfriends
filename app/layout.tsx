import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";
import { InstallPrompt } from "@/components/install-prompt";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "BetWithFriends",
  description: "World Cup 2026 betting pools with friends",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BetWithFriends" },
  icons: {
    icon: [{ url: "/favicon_bwf.png", type: "image/png" }],
    shortcut: "/favicon_bwf.png",
    apple: "/favicon_bwf.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0f23",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/favicon_bwf.png" />
      </head>
      <body className="h-full bg-background text-foreground antialiased">
        <ServiceWorkerRegistrar />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
