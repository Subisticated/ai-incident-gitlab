import { useEffect, useState } from "react";
import { api } from "../api";

const INITIAL_FORM = {
  gitlabProjectUrl: "",
  gitlabAccessToken: "",
  displayName: ""
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.getProjects();
      setProjects(res.items || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.connectProject(form);
      setForm(INITIAL_FORM);
      await load();
    } catch (err) {
      setError(err.message || "Failed to connect project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl space-y-8">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Connect GitLab Project</h2>
        <p className="text-gray-600 mb-6 leading-relaxed">
          Provide a GitLab project URL and a token (with repo read+write) to let the
          copilot file incidents, push branches, and open merge requests.
        </p>
        <form
          className="grid gap-6 max-w-2xl"
          onSubmit={handleSubmit}
        >
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-2 block">Project URL</span>
            <input
              className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              type="url"
              required
              placeholder="https://gitlab.com/org/repo"
              value={form.gitlabProjectUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, gitlabProjectUrl: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-2 block">Personal Access Token</span>
            <input
              className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              type="password"
              required
              placeholder="glpat-..."
              value={form.gitlabAccessToken}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, gitlabAccessToken: e.target.value }))
              }
            />
            <span className="text-xs text-gray-500 mt-1 block">
              Needed for repo read/write. Store securely in prod; this is a hackathon demo.
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-2 block">Display name (optional)</span>
            <input
              className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              type="text"
              placeholder="Marketing service"
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
            />
          </label>
          <div className="flex flex-col gap-3">
            <button
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={saving}
            >
              {saving ? "Connecting..." : "Connect Project"}
            </button>
            {error ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            ) : null}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Connected Projects</h3>
          <button
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !projects.length ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No projects connected yet. Add your first project above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Namespace</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">GitLab URL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((project) => (
                  <tr key={project._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{project.name}</td>
                    <td className="px-4 py-3 text-gray-600">{project.gitlabNamespace || "-"}</td>
                    <td className="px-4 py-3">
                      <a
                        href={project.gitlabUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {project.gitlabUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(project.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
