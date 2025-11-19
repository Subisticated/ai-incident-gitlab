export type Severity = "low" | "medium" | "high" | "critical";
export type Status = "open" | "in-progress" | "resolved" | "closed";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  gitlabIssueId?: string;
  assignee?: string;
  tags?: string[];
}
