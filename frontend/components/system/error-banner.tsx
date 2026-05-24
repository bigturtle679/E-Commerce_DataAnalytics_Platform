"use client";

import { LiveIndicator } from "@/components/system/live-indicator";
import { motion, AnimatePresence } from "framer-motion";

interface ErrorBannerProps {
  isError: boolean;
  failureCount?: number;
  isFetching?: boolean;
  message?: string;
}

export function ErrorBanner({
  isError,
  failureCount = 0,
  isFetching = false,
  message,
}: ErrorBannerProps) {
  const isRetrying = isError && isFetching;

  return (
    <AnimatePresence>
      {isError && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.06]">
            <LiveIndicator
              status={isRetrying ? "delayed" : "offline"}
              size="sm"
            />
            <span className="text-xs font-medium text-destructive/90">
              {isRetrying
                ? `Reconnecting... (attempt ${failureCount})`
                : message ?? "Unable to reach API"}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
