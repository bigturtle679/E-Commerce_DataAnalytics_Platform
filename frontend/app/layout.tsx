import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { FloatingDock } from "@/components/navigation/floating-dock";
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
  title: "Meridian — Command Center",
  description: "Cinematic data operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} dark antialiased`}
      suppressHydrationWarning
    >
      <body className="font-sans text-foreground bg-background overflow-hidden">
        <Providers>
          {/* Animated gradient mesh background */}
          <div className="gradient-mesh" aria-hidden="true">
            <div className="gradient-mesh-accent" />
          </div>

          <FloatingDock />

          <main className="relative z-10 h-screen flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
