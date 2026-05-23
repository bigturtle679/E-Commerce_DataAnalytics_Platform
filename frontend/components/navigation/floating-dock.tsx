"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: <CommandIcon /> },
  { href: "/pipeline", label: "Pipeline", icon: <PipelineIcon /> },
  { href: "/quality", label: "Integrity", icon: <QualityIcon /> },
  { href: "/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
];

export function FloatingDock() {
  const pathname = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Hide dock when scrolling down, show when scrolling up or at top
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = (e: any) => {
      // e.detail is the lenis event. Alternatively, fallback to window.scrollY
      const currentScrollY = e.detail ? e.detail.animatedScroll : window.scrollY;
      
      if (currentScrollY > 100 && currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("lenis-scroll", handleScroll);
    window.addEventListener("scroll", handleScroll); // Fallback

    return () => {
      window.removeEventListener("lenis-scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="pointer-events-auto flex items-center gap-2 p-2 hud-panel rounded-full"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="hud-grain rounded-full" />
            
            {NAV_ITEMS.map((item, i) => {
              const active = pathname === item.href;
              const isHovered = hoveredIndex === i;

              return (
                <Link key={item.href} href={item.href} className="flex">
                  <motion.div
                    onMouseEnter={() => setHoveredIndex(i)}
                    className="relative flex flex-col items-center justify-center cursor-pointer"
                    animate={{
                      width: isHovered ? 80 : 56,
                      height: 56,
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  >
                    {/* Active Pill Indicator */}
                    {active && (
                      <motion.div
                        layoutId="dock-active"
                        className="absolute inset-0 bg-primary/10 rounded-full border border-primary/20 shadow-[inset_0_0_12px_rgba(224,122,95,0.1)]"
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      />
                    )}

                    {/* Icon */}
                    <motion.div
                      className={cn(
                        "relative z-10 flex h-full items-center justify-center transition-colors",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                      animate={{
                        y: isHovered ? -8 : 0,
                        scale: isHovered ? 1.1 : 1,
                        color: active ? "var(--primary)" : isHovered ? "var(--foreground)" : "var(--muted-foreground)"
                      }}
                    >
                      {item.icon}
                    </motion.div>

                    {/* Hover Label */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.span
                          initial={{ opacity: 0, y: 10, scale: 0.8 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.8 }}
                          className="absolute bottom-1.5 text-[10px] font-semibold tracking-wide text-foreground z-10 pointer-events-none"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Minimalist Icons
function CommandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function PipelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v-3a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
      <path d="M4 12v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function QualityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
