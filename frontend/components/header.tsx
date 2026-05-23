"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LiveIndicator } from "@/components/system/live-indicator";
import { useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const [time, setTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function update() {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-xl border-b border-white/[0.06] pointer-events-none" />

      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-40"
        style={{
          background: "linear-gradient(90deg, transparent, var(--primary), var(--warning), transparent)",
        }}
      />

      <div className="relative z-10 flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-wide text-foreground truncate">{title}</h1>
          {description && (
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] truncate">{description}</p>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3 sm:gap-5 shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <LiveIndicator status="healthy" size="sm" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            Operational
          </span>
        </div>

        {mounted && (
          <span className="hidden sm:block font-mono text-[11px] text-foreground/70 tabular-nums font-medium tracking-wider">
            {time}
          </span>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
