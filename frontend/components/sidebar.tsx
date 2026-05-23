"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LiveIndicator } from "@/components/system/live-indicator";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: "/quality",
    label: "Data Quality",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Depth shadow */}
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent" />

      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          {/* Logo pulse */}
          <div className="absolute inset-0 rounded-md bg-primary animate-pulse-glow opacity-30" />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="relative text-primary-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Meridian</span>
          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em]">
            Command
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Active indicator — animated pill */}
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: "var(--m-surface-2)",
                    boxShadow: "inset 0 0 0 1px var(--m-border-subtle), var(--m-shadow-sm)",
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                />
              )}

              {/* Hover background */}
              {!active && (
                <div className="absolute inset-0 rounded-lg bg-sidebar-accent/0 group-hover:bg-sidebar-accent/60 transition-colors duration-200" />
              )}

              {/* Icon */}
              <span className={cn(
                "relative z-10 transition-colors duration-200",
                active ? "text-primary" : "group-hover:text-foreground",
              )}>
                {item.icon}
              </span>

              {/* Label */}
              <span className="relative z-10">{item.label}</span>

              {/* Live dot for active pages */}
              {active && (
                <span className="relative z-10 ml-auto">
                  <LiveIndicator status="healthy" size="sm" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-3">
        <div className="flex items-center gap-2">
          <LiveIndicator status="healthy" size="sm" />
          <div>
            <p className="text-[11px] text-muted-foreground">Meridian</p>
            <p className="text-[10px] text-muted-foreground/50">Data Platform v1.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
