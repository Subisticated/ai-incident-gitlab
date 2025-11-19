const DEFAULT_BASE_URL = "http://localhost:4000/api";
const BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Invalid response from server");
  }

  if (!res.ok || data.success === false) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data.data;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, value);
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  getIncidents: (params) => request(`/incidents${buildQuery(params)}`),
  getIncident: (id) => request(`/incidents/${id}`),
  updateIncident: (id, body) =>
    request(`/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  triggerAnalysis: (id) =>
    request(`/incidents/${id}/analysis`, { method: "POST" }),
  triggerPatch: (id) =>
    request(`/incidents/${id}/patch`, { method: "POST" }),
  createMR: (id) => request(`/incidents/${id}/create-mr`, { method: "POST" }),
  rerunPipeline: (id) => request(`/incidents/${id}/rerun`, { method: "POST" }),

  getProjects: () => request(`/projects`),
  connectProject: (payload) =>
    request(`/projects/connect`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
};