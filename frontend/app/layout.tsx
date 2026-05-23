import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { FloatingDock } from "@/components/navigation/floating-dock";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SpatialBackground } from "@/components/system/spatial-background";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meridian — Spatial Environment",
  description: "Godmode cinematic data platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex font-sans text-foreground bg-background">
        <Providers>
          <SmoothScroll>
            <SpatialBackground />
            <FloatingDock />
            <main className="w-full flex-1 min-h-screen relative z-10 pb-24">
              {children}
            </main>
          </SmoothScroll>
        </Providers>
      </body>
    </html>
  );
}
