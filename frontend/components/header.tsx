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

  useEffect(() => {
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
    <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between px-6 pt-2 pb-2">
      <div className="absolute inset-x-4 inset-y-2 hud-panel pointer-events-none" />
      
      {/* Bottom gradient accent using Horizon palette */}
      <div
        className="absolute bottom-2 left-8 right-8 h-[1px] opacity-30"
        style={{
          background: "linear-gradient(90deg, transparent, var(--primary), var(--warning), transparent)",
        }}
      />

      <div className="relative z-10 flex items-center gap-4 pl-6">
        <div>
          <h1 className="text-sm font-medium tracking-wide text-foreground">{title}</h1>
          {description && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{description}</p>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-6 pr-6">
        {/* System status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
          <LiveIndicator status="healthy" size="sm" />
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Operational
          </span>
        </div>

        {/* Live clock */}
        <span className="font-mono text-[11px] text-foreground/80 tabular-nums font-semibold tracking-wider">
          {time}
        </span>

        <ThemeToggle />
      </div>
    </header>
  );
}
