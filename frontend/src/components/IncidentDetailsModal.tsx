import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { SeverityBadge } from "./SeverityBadge";
import { Incident } from "@/types/incident";
import { GitBranch, Calendar, User, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface IncidentDetailsModalProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncToGitLab: (incidentId: string) => void;
}

export const IncidentDetailsModal = ({
  incident,
  open,
  onOpenChange,
  onSyncToGitLab,
}: IncidentDetailsModalProps) => {
  if (!incident) return null;

  const handleSync = () => {
    onSyncToGitLab(incident.id);
    toast.success("Syncing to GitLab...");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{incident.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
            {incident.tags?.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Description</h4>
              <p className="text-foreground leading-relaxed">{incident.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{format(incident.createdAt, "PPp")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium">{format(incident.updatedAt, "PPp")}</p>
                </div>
              </div>
              {incident.assignee && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Assignee</p>
                    <p className="font-medium">{incident.assignee}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitLab Integration
            </h4>
            {incident.gitlabIssueId ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                    Synced
                  </Badge>
                  <span className="text-sm text-muted-foreground">Issue #{incident.gitlabIssueId}</span>
                </div>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in GitLab
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Not synced to GitLab</span>
                <Button onClick={handleSync} size="sm">
                  <GitBranch className="h-4 w-4 mr-2" />
                  Sync to GitLab
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
