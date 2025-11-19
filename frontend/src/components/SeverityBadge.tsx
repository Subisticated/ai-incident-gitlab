import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Severity = "low" | "medium" | "high" | "critical";

interface SeverityBadgeProps {
  severity: Severity;
}

const severityConfig = {
  low: { label: "Low", className: "bg-success/20 text-success border-success/30" },
  medium: { label: "Medium", className: "bg-warning/20 text-warning border-warning/30" },
  high: { label: "High", className: "bg-destructive/20 text-destructive border-destructive/30" },
  critical: { label: "Critical", className: "bg-critical text-critical-foreground border-critical" },
};

export const SeverityBadge = ({ severity }: SeverityBadgeProps) => {
  const config = severityConfig[severity];
  return (
    <Badge variant="outline" className={cn("font-semibold", config.className)}>
      {config.label}
    </Badge>
  );
};
