import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  empty?: boolean;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  className,
  loading,
  empty,
}: ChartContainerProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[200px] w-full rounded-md" />
          </div>
        ) : empty ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
