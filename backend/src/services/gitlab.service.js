import axios from "axios";
import { Buffer } from "buffer";

const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL || "https://gitlab.com/api/v4";

export function createGitlabClient(project) {
  return axios.create({
    baseURL: GITLAB_BASE_URL,
    headers: {
      "Private-Token": project.gitlabAccessToken,
      "Content-Type": "application/json"
    }
  });
}

export async function createBranch(project, branch, base = "main") {
  const api = createGitlabClient(project);

  try {
    const res = await api.post(
      `/projects/${project.gitlabProjectId}/repository/branches`,
      { branch, ref: base }
    );
    return res.data;
  } catch (err) {
    if (err.response?.data?.message === "Branch already exists") {
      return { exists: true };
    }
    throw err;
  }
}

export async function getFile(project, path, ref = "main") {
  const api = createGitlabClient(project);

  const res = await api.get(
    `/projects/${project.gitlabProjectId}/repository/files/${encodeURIComponent(path)}`,
    { params: { ref } }
  );

  return Buffer.from(res.data.content, "base64").toString("utf8");
}

export async function commitFile(project, branch, filePath, content, message, isNew) {
  const api = createGitlabClient(project);

  const res = await api.post(
    `/projects/${project.gitlabProjectId}/repository/commits`,
    {
      branch,
      commit_message: message,
      actions: [
        {
          action: isNew ? "create" : "update",
          file_path: filePath,
          content
        }
      ]
    }
  );

  return res.data;
}

export async function createMR(project, branch, title, description) {
  const api = createGitlabClient(project);

  const res = await api.post(
    `/projects/${project.gitlabProjectId}/merge_requests`,
    {
      source_branch: branch,
      target_branch: "main",
      title,
      description,
      squash: true,
      remove_source_branch: true
    }
  );

  return res.data;
}

export async function fetchPipeline(project, pipelineId) {
  const api = createGitlabClient(project);
  const res = await api.get(
    `/projects/${project.gitlabProjectId}/pipelines/${pipelineId}`
  );
  return res.data;
}

export async function fetchPipelineJobs(project, pipelineId) {
  const api = createGitlabClient(project);
  const res = await api.get(
    `/projects/${project.gitlabProjectId}/pipelines/${pipelineId}/jobs`
  );
  return res.data || [];
}

export async function fetchJobLog(project, jobId) {
  const api = createGitlabClient(project);
  const res = await api.get(
    `/projects/${project.gitlabProjectId}/jobs/${jobId}/trace`
  );
  return res.data;
}

export async function fetchGitlabCiConfig(project, ref = "main") {
  try {
    return await getFile(project, ".gitlab-ci.yml", ref);
  } catch (err) {
    console.warn("CI config not found:", err.message);
    return null;
  }
}

export async function fetchGitlabProjectInfo(gitlabProjectUrl, gitlabAccessToken) {
  const api = axios.create({
    baseURL: GITLAB_BASE_URL,
    headers: {
      "Private-Token": gitlabAccessToken,
      "Content-Type": "application/json"
    }
  });

  const path = new URL(gitlabProjectUrl).pathname.replace(/^\/+/, "");
  const res = await api.get(`/projects/${encodeURIComponent(path)}`);
  return res.data;
}

export async function retryPipeline(project, pipelineId) {
  const api = createGitlabClient(project);
  
  try {
    const res = await api.post(
      `/projects/${project.gitlabProjectId}/pipelines/${pipelineId}/retry`
    );
    return res.data;
  } catch (err) {
    console.error('Failed to retry pipeline:', err.response?.data || err.message);
    throw new Error(err.response?.data?.message || 'Failed to retry pipeline');
  }
}
