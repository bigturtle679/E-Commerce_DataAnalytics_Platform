"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LiveIndicator } from "@/components/system/live-indicator";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const [time, setTime] = useState<string>("");

  // Live API health check — replaces hardcoded "Operational"
  const pingQ = useQuery({
    queryKey: queryKeys.healthPing,
    queryFn: api.getHealthPing,
    refetchInterval: 15_000, // Check every 15s
    retry: 1,
  });

  const isOnline = pingQ.data?.status === "ok";
  const isLoading = pingQ.isLoading;
  const apiStatus: "healthy" | "delayed" | "offline" = isLoading
    ? "delayed"
    : isOnline
      ? "healthy"
      : "offline";
  const statusLabel = isLoading
    ? "Connecting"
    : isOnline
      ? "Operational"
      : "Offline";

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
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 pt-2 pb-2">
      {/* Strong backdrop to prevent 3D scene overlap */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-white/5 pointer-events-none" />
      
      {/* Bottom gradient accent using Horizon palette */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px] opacity-30"
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
        {/* System status — live from /api/health/ping */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
          <LiveIndicator status={apiStatus} size="sm" />
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            {statusLabel}
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
