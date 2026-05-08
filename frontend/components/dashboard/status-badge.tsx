import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "success" | "failure" | "ok" | "warn" | "error" | "unknown" | string;
  className?: string;
}

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  success: { label: "Success", variant: "bg-success/15 text-success border-success/20" },
  ok: { label: "Healthy", variant: "bg-success/15 text-success border-success/20" },
  failure: { label: "Failed", variant: "bg-destructive/15 text-destructive border-destructive/20" },
  error: { label: "Error", variant: "bg-destructive/15 text-destructive border-destructive/20" },
  warn: { label: "Warning", variant: "bg-warning/15 text-warning border-warning/20" },
  unknown: { label: "Unknown", variant: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.unknown;
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-medium px-2 py-0.5", config.variant, className)}
    >
      {config.label}
    </Badge>
  );
}
