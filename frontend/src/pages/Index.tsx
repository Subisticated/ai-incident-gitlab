import { useState } from "react";
import { IncidentTable } from "@/components/IncidentTable";
import { IncidentFilters } from "@/components/IncidentFilters";
import { CreateIncidentModal } from "@/components/CreateIncidentModal";
import { IncidentDetailsModal } from "@/components/IncidentDetailsModal";
import { Incident, Severity, Status } from "@/types/incident";
import { AlertTriangle } from "lucide-react";

// Mock data
const mockIncidents: Incident[] = [
  {
    id: "1",
    title: "Model hallucination detected in production",
    description: "GPT-4 API returning factually incorrect information about historical events",
    severity: "high",
    status: "in-progress",
    createdAt: new Date(2025, 0, 15),
    updatedAt: new Date(2025, 0, 16),
    assignee: "Sarah Chen",
    tags: ["production", "gpt-4"],
    gitlabIssueId: "42",
  },
  {
    id: "2",
    title: "Unexpected AI bias in recommendation system",
    description: "Content recommendations showing demographic bias in user testing",
    severity: "critical",
    status: "open",
    createdAt: new Date(2025, 0, 14),
    updatedAt: new Date(2025, 0, 14),
    assignee: "Alex Kumar",
    tags: ["bias", "recommendations"],
  },
  {
    id: "3",
    title: "Response latency spike on Claude API",
    description: "Average response time increased from 2s to 15s during peak hours",
    severity: "medium",
    status: "resolved",
    createdAt: new Date(2025, 0, 10),
    updatedAt: new Date(2025, 0, 12),
    assignee: "Jordan Lee",
    tags: ["performance", "api"],
    gitlabIssueId: "38",
  },
  {
    id: "4",
    title: "Data drift detected in training pipeline",
    description: "Model performance degraded by 12% due to unexpected data distribution shift",
    severity: "high",
    status: "open",
    createdAt: new Date(2025, 0, 8),
    updatedAt: new Date(2025, 0, 9),
    assignee: "Maria Rodriguez",
    tags: ["ml-ops", "training"],
  },
  {
    id: "5",
    title: "Prompt injection vulnerability found",
    description: "Security team identified potential prompt injection attack vector in chatbot",
    severity: "critical",
    status: "in-progress",
    createdAt: new Date(2025, 0, 5),
    updatedAt: new Date(2025, 0, 7),
    assignee: "David Park",
    tags: ["security", "chatbot"],
  },
];

const Index = () => {
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleCreateIncident = (newIncident: Omit<Incident, "id" | "createdAt" | "updatedAt">) => {
    const incident: Incident = {
      ...newIncident,
      id: String(incidents.length + 1),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setIncidents([incident, ...incidents]);
  };

  const handleIncidentClick = (incident: Incident) => {
    setSelectedIncident(incident);
    setDetailsOpen(true);
  };

  const handleSyncToGitLab = (incidentId: string) => {
    setIncidents(
      incidents.map((inc) =>
        inc.id === incidentId
          ? { ...inc, gitlabIssueId: String(Math.floor(Math.random() * 1000)) }
          : inc
      )
    );
  };

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      search === "" ||
      incident.title.toLowerCase().includes(search.toLowerCase()) ||
      incident.description.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Incident Tracker</h1>
              <p className="text-muted-foreground">Monitor and manage AI system incidents</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Incidents</h2>
              <p className="text-muted-foreground">
                {filteredIncidents.length} of {incidents.length} incidents
              </p>
            </div>
            <CreateIncidentModal onCreateIncident={handleCreateIncident} />
          </div>

          <IncidentFilters
            search={search}
            onSearchChange={setSearch}
            severityFilter={severityFilter}
            onSeverityChange={setSeverityFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />

          <IncidentTable incidents={filteredIncidents} onIncidentClick={handleIncidentClick} />
        </div>
      </main>

      <IncidentDetailsModal
        incident={selectedIncident}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onSyncToGitLab={handleSyncToGitLab}
      />
    </div>
  );
};

export default Index;
