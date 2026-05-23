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
    <header className="relative flex h-14 items-center justify-between border-b border-border px-6">
      {/* Bottom gradient accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, oklch(0.65 0.22 260 / 15%), oklch(0.7 0.18 200 / 10%), transparent)",
        }}
      />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* System status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50">
          <LiveIndicator status="healthy" size="sm" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            All Systems Operational
          </span>
        </div>

        {/* Live clock */}
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {time}
        </span>

        <ThemeToggle />
      </div>
    </header>
  );
}
