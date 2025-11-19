import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { RefreshCw, Filter, Zap, GitMerge, Clock, XCircle } from "lucide-react";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Fixing", value: "in_progress" },
  { label: "Resolved", value: "resolved" }
];

const STATUS_COLORS = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  pending: "bg-slate-100 text-slate-700",
  running: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-800",
  ready: "bg-cyan-100 text-cyan-800",
  failed: "bg-rose-100 text-rose-800",
  not_requested: "bg-gray-100 text-gray-700",
  open_mr: "bg-blue-100 text-blue-800",
  fixing: "bg-amber-100 text-amber-900"
};

function StatusBadge({ value }) {
  if (!value) return null;
  const normalized = value.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        STATUS_COLORS[value] || "bg-gray-100 text-gray-700"
      }`}
    >
      {normalized}
    </span>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ projectId: "", status: "" });
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.getIncidents(filters);
      setIncidents(res.items || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.status, filters.projectId]);

  useEffect(() => {
    let mounted = true;

    const fetchProjects = async () => {
      try {
        setProjectsLoading(true);
        const res = await api.getProjects();
        if (mounted) {
          setProjects(res.items || []);
          setProjectError("");
        }
      } catch (err) {
        if (mounted) {
          setProjectError(err.message || "Failed to load projects");
        }
      } finally {
        if (mounted) {
          setProjectsLoading(false);
        }
      }
    };

    fetchProjects();

    return () => {
      mounted = false;
    };
  }, []);

  const actionKey = (id, type) => `${id}:${type}`;
  const setLoadingFor = (id, type, value) => {
    setActionLoading((prev) => {
      const key = actionKey(id, type);
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const isActionLoading = (id, type) => Boolean(actionLoading[actionKey(id, type)]);

  const handleIncidentAction = async (incidentId, type) => {
    console.log('Button clicked:', { incidentId, type });
    setActionError("");
    setActionMessage("");
    setLoadingFor(incidentId, type, true);

    try {
      console.log('Calling API for:', type);
      if (type === "analysis") await api.triggerAnalysis(incidentId);
      if (type === "patch") await api.triggerPatch(incidentId);
      if (type === "mr") await api.createMR(incidentId);
      if (type === "rerun") await api.rerunPipeline(incidentId);

      const messageMap = {
        analysis: "AI analysis started",
        patch: "AI patch requested",
        mr: "Merge request workflow started",
        rerun: "Pipeline rerun requested"
      };
      setActionMessage(messageMap[type] || "Action triggered");
      console.log('Action successful:', messageMap[type]);
      await load();
    } catch (err) {
      console.error('Action failed:', err);
      setActionError(err.message || "Action failed");
    } finally {
      setLoadingFor(incidentId, type, false);
    }
  };

  const canRunAction = (incident, type) => {
    if (!incident) return false;
    if (type === "analysis") return incident.analysisStatus !== "running";
    if (type === "patch")
      return incident.analysisStatus === "done" && incident.patchStatus !== "running";
    if (type === "mr")
      return (
        incident.patchStatus === "ready" &&
        ["not_requested", "failed"].includes(incident.mrStatus || "not_requested")
      );
    if (type === "rerun") return Boolean(incident.pipelineId);
    return true;
  };

  const automationCounts = useMemo(() => {
    const ready = incidents.filter(
      (i) => i.patchStatus === "ready" && i.mrStatus === "not_requested"
    ).length;
    const activeMRs = incidents.filter((i) => i.mrStatus === "open").length;
    const fixing = incidents.filter((i) => i.mrStatus === "fixing").length;
    const failed = incidents.filter((i) => i.mrStatus === "failed").length;
    return { ready, activeMRs, fixing, failed };
  }, [incidents]);

  const statsConfig = [
    { key: "ready", label: "Patch ready", helper: "Click 'Create MR' to ship", icon: Zap, color: "from-cyan-500 to-teal-600" },
    { key: "activeMRs", label: "MR open", helper: "Waiting on pipeline", icon: GitMerge, color: "from-blue-500 to-indigo-600" },
    { key: "fixing", label: "Retrying patch", helper: "Automation pushing new commits", icon: Clock, color: "from-amber-500 to-orange-600" },
    { key: "failed", label: "Failed", helper: "Manual attention needed", icon: XCircle, color: "from-rose-500 to-red-600" },
  ];

  const renderActionButton = (incident, type, label) => (
    <button
      key={type}
      className="text-xs px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={() => handleIncidentAction(incident._id, type)}
      disabled={!canRunAction(incident, type) || isActionLoading(incident._id, type)}
    >
      {isActionLoading(incident._id, type) ? `${label}...` : label}
    </button>
  );

  return (
    <div className="max-w-7xl space-y-6">
      {actionError && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-red-900 font-semibold">Action Failed</p>
            <p className="text-red-700 text-sm">{actionError}</p>
          </div>
        </div>
      )}

      {actionMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <GitMerge className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-emerald-900 font-semibold">Success</p>
            <p className="text-emerald-700 text-sm">{actionMessage}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Incidents</h2>
          <p className="text-gray-600">
            Webhook-created failures enriched with AI analysis + patch suggestions.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || "all"}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filters.status === filter.value
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setFilters((prev) => ({ ...prev, status: filter.value }))}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <label className="text-sm font-semibold text-gray-700">
            Project Filter:
          </label>
          <select
            className="border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            value={filters.projectId}
            onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
            disabled={projectsLoading}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name || project.gitlabNamespace || project.gitlabUrl}
              </option>
            ))}
          </select>
          {projectError ? <span className="text-xs text-red-500">{projectError}</span> : null}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      ) : null}
      {actionError ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-700 text-sm font-medium">{actionError}</p>
        </div>
      ) : null}
      {actionMessage ? (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-lg">
          <p className="text-emerald-700 text-sm font-medium">{actionMessage}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statsConfig.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="group relative overflow-hidden rounded-xl bg-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <div className="relative p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-4xl font-bold text-gray-900 mt-2">{automationCounts[stat.key]}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{stat.helper}</p>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-xl shadow-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading incidents...</p>
          </div>
        </div>
      ) : !incidents.length ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-lg">
          <div className="max-w-md mx-auto">
            <div className="mb-4 flex justify-center">
              <div className="p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full">
                <XCircle className="w-12 h-12 text-gray-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No incidents found</h3>
            <p className="text-gray-600">Break your pipeline to see incidents appear here. 🚀</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gradient-to-r from-slate-50 to-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Incident</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Project / Git</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Pipeline</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Automation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">AI Insight</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incidents.map((inc) => (
                  <tr key={inc._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-gray-900 font-medium">{inc._id}</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {inc.gitRef || "unknown"} · {inc.commitSha?.slice(0, 7) || "no sha"}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(inc.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold text-gray-900">{inc.project?.name || "N/A"}</div>
                      <div className="text-gray-500 text-[10px] mt-1 truncate max-w-xs">{inc.project?.gitlabUrl}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Retries: {inc.retryCount || 0}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {inc.pipelineId ? (
                        <a
                          href={inc.pipelineUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
                        >
                          Pipeline #{inc.pipelineId}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      <div className="text-gray-500 mt-1">Job: {inc.jobName || "-"}</div>
                      {inc.mergeRequest?.url ? (
                        <div className="text-gray-500 mt-1">
                          MR:{" "}
                          <a
                            href={inc.mergeRequest.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
                          >
                            !{inc.mergeRequest.mrIid}
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 min-w-[60px]">Incident:</span>
                        <StatusBadge value={inc.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 min-w-[60px]">Analysis:</span>
                        <StatusBadge value={inc.analysisStatus} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 min-w-[60px]">Patch:</span>
                        <StatusBadge value={inc.patchStatus} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 min-w-[60px]">MR:</span>
                        <StatusBadge value={inc.mrStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-semibold text-gray-900 mb-1">Category: {inc.category || "-"}</p>
                      {inc.aiAnalysis?.summary ? (
                        <p className="text-gray-600 text-[11px] break-words max-h-20 overflow-hidden leading-relaxed">
                          {inc.aiAnalysis.summary}
                        </p>
                      ) : (
                        <p className="text-gray-400 italic">Awaiting AI analysis</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {renderActionButton(inc, "analysis", "AI Analysis")}
                        {renderActionButton(inc, "patch", "AI Patch")}
                        {renderActionButton(inc, "mr", "Create MR")}
                        {renderActionButton(inc, "rerun", "Rerun")}
                        <Link
                          to={`/incidents/${inc._id}`}
                          className="text-xs px-3 py-1.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:shadow transition-all duration-200"
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}