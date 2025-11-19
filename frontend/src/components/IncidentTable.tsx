import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { SeverityBadge } from "./SeverityBadge";
import { Incident } from "@/types/incident";
import { format } from "date-fns";
import { GitBranch } from "lucide-react";

interface IncidentTableProps {
  incidents: Incident[];
  onIncidentClick: (incident: Incident) => void;
}

export const IncidentTable = ({ incidents, onIncidentClick }: IncidentTableProps) => {
  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No incidents found</p>
        <p className="text-sm mt-2">Create a new incident to get started</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Title</TableHead>
            <TableHead className="font-semibold">Severity</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Assignee</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
            <TableHead className="font-semibold w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow
              key={incident.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onIncidentClick(incident)}
            >
              <TableCell className="font-medium">{incident.title}</TableCell>
              <TableCell>
                <SeverityBadge severity={incident.severity} />
              </TableCell>
              <TableCell>
                <StatusBadge status={incident.status} />
              </TableCell>
              <TableCell>{incident.assignee || "-"}</TableCell>
              <TableCell className="text-muted-foreground">
                {format(incident.createdAt, "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                {incident.gitlabIssueId && (
                  <div className="flex items-center" title="Synced to GitLab">
                    <GitBranch className="h-4 w-4 text-success" />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
