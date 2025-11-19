import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { TrendingUp, AlertTriangle, CheckCircle2, Clock, Rocket } from "lucide-react";

const CARD_COLORS = {
  total: "from-blue-500 to-blue-600",
  open: "from-amber-500 to-orange-600",
  fixing: "from-purple-500 to-purple-600",
  resolved: "from-emerald-500 to-green-600",
  ready: "from-cyan-500 to-teal-600",
};

const CARD_ICONS = {
  total: TrendingUp,
  open: AlertTriangle,
  fixing: Clock,
  resolved: CheckCircle2,
  ready: Rocket,
};

function StatCard({ label, value, helper, colorKey = "total" }) {
  const Icon = CARD_ICONS[colorKey] || TrendingUp;
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      <div className={`absolute inset-0 bg-gradient-to-br ${CARD_COLORS[colorKey]} opacity-5 group-hover:opacity-10 transition-opacity`} />
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${CARD_COLORS[colorKey]} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {helper ? <p className="text-xs text-gray-500 leading-relaxed">{helper}</p> : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.getIncidents();
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
  }, []);

  const summary = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter((i) => i.status === "open").length;
    const inProgress = incidents.filter((i) => i.status === "in_progress").length;
    const resolved = incidents.filter((i) => i.status === "resolved").length;
    const readyForMR = incidents.filter(
      (i) => i.patchStatus === "ready" && i.mrStatus === "not_requested"
    ).length;

    return {
      total,
      open,
      inProgress,
      resolved,
      readyForMR
    };
  }, [incidents]);

  const latestIncidents = incidents.slice(0, 5);

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-500">Monitor your AI incident automation pipeline</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
          <StatCard label="Total incidents" value={summary.total} colorKey="total" />
          <StatCard
            label="Open"
            value={summary.open}
            helper="Awaiting webhook automation"
            colorKey="open"
          />
          <StatCard
            label="Fixing"
            value={summary.inProgress}
            helper="Automation working"
            colorKey="fixing"
          />
          <StatCard
            label="Resolved"
            value={summary.resolved}
            helper="Closed after successful MR"
            colorKey="resolved"
          />
          <StatCard
            label="Ready for MR"
            value={summary.readyForMR}
            helper="Patch ready – click Create MR"
            colorKey="ready"
          />
        </div>
      )}

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Latest incidents</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !latestIncidents.length ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No incidents yet. Ship something buggy to see the magic ✨
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Incident</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Statuses</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {latestIncidents.map((incident) => (
                  <tr key={incident._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-900">{incident._id}</div>
                      <div className="text-xs text-gray-500">
                        #{incident.pipelineId} · {incident.jobName || "job"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {incident.project?.name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {incident.status}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {incident.analysisStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/incidents/${incident._id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium rounded-lg shadow hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
