import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "open" | "in-progress" | "resolved" | "closed";

interface StatusBadgeProps {
  status: Status;
}

const statusConfig = {
  open: { label: "Open", className: "bg-muted text-muted-foreground" },
  "in-progress": { label: "In Progress", className: "bg-primary/20 text-primary border-primary/30" },
  resolved: { label: "Resolved", className: "bg-success/20 text-success border-success/30" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
};
