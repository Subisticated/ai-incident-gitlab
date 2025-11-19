import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { AlertCircle, RefreshCw, GitBranch, FileCode, GitMerge, Activity } from "lucide-react";

const STATUS_COLORS = {
  open: "bg-slate-100 text-slate-800",
  in_progress: "bg-amber-100 text-amber-900",
  resolved: "bg-emerald-100 text-emerald-800",
  pending: "bg-gray-100 text-gray-700",
  running: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-700",
  ready: "bg-cyan-100 text-cyan-800",
  failed: "bg-rose-100 text-rose-800",
  fixing: "bg-amber-100 text-amber-900",
  not_requested: "bg-slate-100 text-slate-700",
  open_mr: "bg-blue-100 text-blue-800"
};

function StatusBadge({ value }) {
  if (!value) return <span className="text-xs text-gray-500">-</span>;
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

export default function IncidentDetails() {
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const nextStatus = useMemo(() => {
    if (!incident) return "open";
    if (incident.status === "open") return "in_progress";
    if (incident.status === "in_progress") return "resolved";
    return "open";
  }, [incident]);

  async function loadIncident() {
    try {
      setLoading(true);
      const res = await api.getIncident(id);
      setIncident(res.incident);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load incident");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncident();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAnalysis() {
    try {
      setActionLoading("analysis");
      await api.triggerAnalysis(id);
      await loadIncident();
    } catch (err) {
      setError(err.message || "Failed to run AI analysis");
    } finally {
      setActionLoading("");
    }
  }

  async function handlePatch() {
    try {
      setActionLoading("patch");
      await api.triggerPatch(id);
      await loadIncident();
    } catch (err) {
      setError(err.message || "Failed to generate patch");
    } finally {
      setActionLoading("");
    }
  }

  async function handleCreateMR() {
    try {
      setActionLoading("mr");
      await api.createMR(id);
      await loadIncident();
    } catch (err) {
      setError(err.message || "Failed to create MR");
    } finally {
      setActionLoading("");
    }
  }

  async function handleRerun() {
    try {
      setActionLoading("rerun");
      await api.rerunPipeline(id);
      await loadIncident();
    } catch (err) {
      setError(err.message || "Failed to rerun pipeline");
    } finally {
      setActionLoading("");
    }
  }

  async function handleStatusUpdate(nextStatus) {
    try {
      setActionLoading("update");
      await api.updateIncident(id, { status: nextStatus });
      await loadIncident();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading incident details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-red-900 font-semibold mb-1">Error loading incident</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!incident) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-gray-900 font-semibold mb-1">Incident not found</h3>
        <p className="text-gray-600">The incident you're looking for doesn't exist.</p>
      </div>
    );
  }

  const aiAnalysis = incident?.aiAnalysis;
  const aiPatch = incident?.aiPatch;
  const mr = incident?.mergeRequest;

  const actionButtons = [
    {
      label: "Run AI Analysis",
      action: handleAnalysis,
      loadingKey: "analysis",
      disabled: incident?.analysisStatus === "running"
    },
    {
      label: "Generate AI Patch",
      action: handlePatch,
      loadingKey: "patch",
      disabled: incident?.patchStatus === "running" || incident?.analysisStatus !== "done"
    },
    {
      label: "Create Merge Request",
      action: handleCreateMR,
      loadingKey: "mr",
      disabled: incident?.patchStatus !== "ready" || incident?.mrStatus === "open"
    },
    {
      label: "Rerun pipeline",
      action: handleRerun,
      loadingKey: "rerun",
      disabled: false
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="w-7 h-7" />
            Incident Details
          </h2>
          <button
            onClick={loadIncident}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="font-mono text-sm sm:text-base lg:text-lg font-semibold mb-3 break-all">{incident._id}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-blue-100 text-xs uppercase mb-1">Project</div>
              <div className="font-semibold">{incident.project?.name || "N/A"}</div>
              {incident.project?.gitlabUrl && (
                <a
                  href={incident.project.gitlabUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-200 hover:text-white underline text-xs mt-1 inline-block"
                >
                  Open in GitLab →
                </a>
              )}
            </div>
            <div>
              <div className="text-blue-100 text-xs uppercase mb-1">Category</div>
              <div className="font-semibold">{incident.category || "Not categorized"}</div>
            </div>
            <div>
              <div className="text-blue-100 text-xs uppercase mb-1">Retry Count</div>
              <div className="font-semibold">{incident.retryCount || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: "Incident", value: incident.status, icon: AlertCircle, gradient: "from-slate-500 to-slate-600" },
          { label: "AI Analysis", value: incident.analysisStatus, icon: Activity, gradient: "from-blue-500 to-indigo-600" },
          { label: "AI Patch", value: incident.patchStatus, icon: FileCode, gradient: "from-amber-500 to-orange-600" },
          { label: "Merge Request", value: incident.mrStatus, icon: GitMerge, gradient: "from-emerald-500 to-green-600" }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-200">
              <div className={`bg-gradient-to-r ${card.gradient} p-4`}>
                <div className="flex items-center gap-2 text-white mb-2">
                  <Icon className="w-5 h-5" />
                  <p className="text-sm font-semibold">{card.label}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                  <StatusBadge value={card.value} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Incident Metadata</h3>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="border-l-4 border-blue-500 pl-3">
            <dt className="text-gray-500 text-xs uppercase font-semibold mb-1">Pipeline</dt>
            <dd className="text-gray-900">
              {incident.pipelineId ? (
                <a
                  href={incident.pipelineUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  #{incident.pipelineId}
                </a>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </dd>
          </div>
          <div className="border-l-4 border-purple-500 pl-3">
            <dt className="text-gray-500 text-xs uppercase font-semibold mb-1">Job name / ID</dt>
            <dd className="text-gray-900">
              {incident.jobName || "-"} {incident.jobId ? `(#${incident.jobId})` : ""}
            </dd>
          </div>
          <div className="border-l-4 border-emerald-500 pl-3">
            <dt className="text-gray-500 text-xs uppercase font-semibold mb-1">Git ref</dt>
            <dd className="font-mono text-xs text-gray-900">{incident.gitRef || "-"}</dd>
          </div>
          <div className="border-l-4 border-amber-500 pl-3">
            <dt className="text-gray-500 text-xs uppercase font-semibold mb-1">Commit SHA</dt>
            <dd className="font-mono text-xs text-gray-900">{incident.commitSha || "-"}</dd>
          </div>
          <div className="border-l-4 border-cyan-500 pl-3">
            <dt className="text-gray-500 text-xs uppercase font-semibold mb-1">Created at</dt>
            <dd className="text-gray-900">{new Date(incident.createdAt).toLocaleString()}</dd>
          </div>
          <div className="border-l-4 border-rose-500 pl-3">
            <dt className="text-gray-500 text-xs uppercase font-semibold mb-1">Updated at</dt>
            <dd className="text-gray-900">{new Date(incident.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-2 lg:gap-3">
        {actionButtons.map((button) => (
          <button
            key={button.label}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
            onClick={button.action}
            disabled={actionLoading === button.loadingKey || button.disabled}
          >
            {actionLoading === button.loadingKey ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {button.label}...
              </span>
            ) : (
              button.label
            )}
          </button>
        ))}
        <button
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
          onClick={() => handleStatusUpdate(nextStatus)}
          disabled={actionLoading === "update"}
        >
          {actionLoading === "update" ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Updating...
            </span>
          ) : (
            `Mark as ${nextStatus.replace("_", " ")}`
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Error Snippet
            </h3>
            <pre className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-xs overflow-auto max-h-40 lg:max-h-48 font-mono text-red-900">
              {incident.errorSnippet || "(no error snippet available)"}
            </pre>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-gray-700" />
              Full Logs
            </h3>
            <pre className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-xs overflow-auto max-h-48 lg:max-h-64 font-mono text-gray-900">
              {incident.fullLogs || "(no logs stored)"}
            </pre>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              AI Analysis
            </h3>
            {aiAnalysis ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <span className="text-blue-900 font-semibold">Summary:</span>
                  <p className="text-gray-700 mt-1">{aiAnalysis.summary}</p>
                </div>
                <div>
                  <span className="text-blue-900 font-semibold">Root Cause:</span>
                  <p className="text-gray-700 mt-1">{aiAnalysis.rootCause}</p>
                </div>
                <div className="flex gap-4 pt-2 border-t border-blue-200">
                  <div>
                    <span className="text-blue-900 font-semibold">Category:</span>
                    <span className="text-gray-700 ml-2">{aiAnalysis.category || "-"}</span>
                  </div>
                  <div>
                    <span className="text-blue-900 font-semibold">Confidence:</span>
                    <span className="text-gray-700 ml-2">{Math.round((aiAnalysis.confidence || 0) * 100)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <Activity className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No AI analysis yet. Click "Run AI Analysis" above.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-amber-600" />
              AI Patch
            </h3>
            {aiPatch ? (
              <div className="border-2 border-amber-200 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                <div className="px-4 py-3 bg-amber-100 border-b-2 border-amber-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-900 font-semibold">{aiPatch.description || "AI-generated patch"}</span>
                    <span className="px-2 py-1 bg-amber-200 text-amber-900 rounded text-xs font-medium">
                      Risk: {aiPatch.riskLevel || "medium"}
                    </span>
                  </div>
                </div>
                <pre className="p-4 text-xs overflow-auto max-h-48 lg:max-h-64 font-mono text-gray-900">{aiPatch.diff}</pre>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <FileCode className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No AI patch yet. Run analysis first, then generate patch.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-emerald-600" />
              Merge Request
            </h3>
            {mr ? (
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-900 font-semibold">MR:</span>
                  <a
                    href={mr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:text-emerald-800 font-medium hover:underline"
                  >
                    !{mr.mrIid}
                  </a>
                </div>
                <div>
                  <span className="text-emerald-900 font-semibold">Branch:</span>
                  <span className="text-gray-700 ml-2 font-mono text-sm">{mr.branchName}</span>
                </div>
                <div>
                  <span className="text-emerald-900 font-semibold">Status:</span>
                  <span className="text-gray-700 ml-2">{mr.status}</span>
                </div>
                {mr.lastCheckedAt && (
                  <p className="text-xs text-gray-500 pt-2 border-t border-emerald-200">
                    Last checked {new Date(mr.lastCheckedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <GitMerge className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  No MR yet. Use "Create Merge Request" to push the AI patch and start the GitLab pipeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
