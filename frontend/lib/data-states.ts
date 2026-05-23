/**
 * Data lifecycle state management for Meridian.
 * Provides semantic data states beyond simple loading/error.
 */

export type DataLifecycleState =
  | "loading"
  | "hydrated"
  | "stale"
  | "delayed"
  | "degraded"
  | "retrying"
  | "failed";

export type FreshnessLevel =
  | "healthy"
  | "delayed"
  | "stale"
  | "degraded"
  | "failed";

export interface DataStateConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseColor: string;
  icon: "live" | "delayed" | "stale" | "degraded" | "offline";
}

export const DATA_STATE_MAP: Record<DataLifecycleState, DataStateConfig> = {
  loading: {
    label: "Synchronizing",
    color: "var(--muted-foreground)",
    bgColor: "var(--muted)",
    borderColor: "var(--border)",
    pulseColor: "var(--muted-foreground)",
    icon: "delayed",
  },
  hydrated: {
    label: "Live",
    color: "var(--success)",
    bgColor: "oklch(0.65 0.2 150 / 8%)",
    borderColor: "oklch(0.65 0.2 150 / 20%)",
    pulseColor: "var(--success)",
    icon: "live",
  },
  stale: {
    label: "Stale",
    color: "var(--warning)",
    bgColor: "oklch(0.75 0.18 80 / 8%)",
    borderColor: "oklch(0.75 0.18 80 / 20%)",
    pulseColor: "var(--warning)",
    icon: "stale",
  },
  delayed: {
    label: "Delayed",
    color: "var(--warning)",
    bgColor: "oklch(0.75 0.18 80 / 6%)",
    borderColor: "oklch(0.75 0.18 80 / 15%)",
    pulseColor: "var(--warning)",
    icon: "delayed",
  },
  degraded: {
    label: "Degraded",
    color: "oklch(0.7 0.2 40)",
    bgColor: "oklch(0.7 0.2 40 / 8%)",
    borderColor: "oklch(0.7 0.2 40 / 20%)",
    pulseColor: "oklch(0.7 0.2 40)",
    icon: "degraded",
  },
  retrying: {
    label: "Reconnecting",
    color: "var(--primary)",
    bgColor: "oklch(0.65 0.22 260 / 6%)",
    borderColor: "oklch(0.65 0.22 260 / 15%)",
    pulseColor: "var(--primary)",
    icon: "delayed",
  },
  failed: {
    label: "Offline",
    color: "var(--destructive)",
    bgColor: "oklch(0.65 0.22 25 / 6%)",
    borderColor: "oklch(0.65 0.22 25 / 15%)",
    pulseColor: "var(--destructive)",
    icon: "offline",
  },
};

/**
 * Compute freshness level from hours since last load.
 */
export function getFreshnessLevel(hoursSinceLoad: number | null): FreshnessLevel {
  if (hoursSinceLoad === null) return "failed";
  if (hoursSinceLoad <= 36) return "healthy";
  if (hoursSinceLoad <= 72) return "delayed";
  if (hoursSinceLoad <= 168) return "stale";
  return "degraded";
}

export const FRESHNESS_CONFIG: Record<FreshnessLevel, { label: string; color: string; bgColor: string }> = {
  healthy: { label: "Fresh", color: "var(--success)", bgColor: "oklch(0.65 0.2 150 / 10%)" },
  delayed: { label: "Delayed", color: "var(--warning)", bgColor: "oklch(0.75 0.18 80 / 10%)" },
  stale: { label: "Stale", color: "oklch(0.7 0.2 40)", bgColor: "oklch(0.7 0.2 40 / 10%)" },
  degraded: { label: "Degraded", color: "var(--destructive)", bgColor: "oklch(0.65 0.22 25 / 10%)" },
  failed: { label: "Unknown", color: "var(--muted-foreground)", bgColor: "var(--muted)" },
};

/**
 * Derive lifecycle state from React Query status + data age.
 */
export function deriveDataState(
  isLoading: boolean,
  isError: boolean,
  isFetching: boolean,
  dataUpdatedAt: number,
  failureCount: number,
): DataLifecycleState {
  if (isLoading) return "loading";
  if (failureCount > 0 && isFetching) return "retrying";
  if (isError && failureCount >= 3) return "failed";
  if (isError) return "degraded";

  const age = Date.now() - dataUpdatedAt;
  const staleThreshold = 2 * 60 * 1000; // 2 minutes
  const degradedThreshold = 5 * 60 * 1000; // 5 minutes

  if (age > degradedThreshold) return "degraded";
  if (age > staleThreshold) return "stale";
  return "hydrated";
}
