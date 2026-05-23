"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: <CommandIcon /> },
  { href: "/pipeline", label: "Pipeline", icon: <PipelineIcon /> },
  { href: "/quality", label: "Integrity", icon: <QualityIcon /> },
  { href: "/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
];

export function FloatingDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50">
      <motion.nav
        initial={{ y: 40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.3 }}
        className="flex items-center gap-1 p-1.5 hud-panel rounded-2xl"
      >
        <div className="hud-grain rounded-2xl" />

        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "relative flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="dock-active"
                    className="absolute inset-0 bg-primary/[0.08] rounded-xl border border-primary/15"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}

                <span className="relative z-10 flex items-center justify-center w-5 h-5">
                  {item.icon}
                </span>

                <span className={cn(
                  "relative z-10 text-xs font-medium tracking-wide hidden sm:block",
                  active ? "text-primary" : ""
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}

function CommandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function PipelineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v-3a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
      <path d="M4 12v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function QualityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
