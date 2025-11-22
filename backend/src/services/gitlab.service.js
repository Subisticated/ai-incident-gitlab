// backend/src/services/gitlab.service.js
import axios from "axios";
import logger from "../utils/logger.js";

const BASE = process.env.GITLAB_BASE_URL?.replace(/\/$/, "") || "https://gitlab.com";
function gitlabClient(projectOrToken) {
  const token = projectOrToken?.gitlabAccessToken || projectOrToken;
  return axios.create({
    baseURL: `${BASE}/api/v4`,
    headers: { "PRIVATE-TOKEN": token }
  });
}

export async function fetchGitlabProjectInfo(token, projectIdOrPath) {
  try {
    const client = gitlabClient(token);
    const encoded = encodeURIComponent(String(projectIdOrPath));
    const res = await client.get(`/projects/${encoded}`);
    return res.data;
  } catch (err) {
    logger.error("[GITLAB] fetchGitlabProjectInfo:", err.response?.data || err.message);
    throw err;
  }
}

export async function getPipelineLogs(project, jobId) {
  const client = gitlabClient(project);
  try {
    logger.info(`[GITLAB] Fetching logs for job ${jobId}`);
    const res = await client.get(`/projects/${project.gitlabProjectId}/jobs/${jobId}/trace`, { responseType: "text" });
    return res.data || "";
  } catch (err) {
    logger.error("[GITLAB] Pipeline logs error:", err.response?.data || err.message);
    throw err;
  }
}

export async function getCiConfig(project, ref = "main") {
  const client = gitlabClient(project);
  try {
    const res = await client.get(`/projects/${project.gitlabProjectId}/repository/files/.gitlab-ci.yml/raw`, { params: { ref }, responseType: "text" });
    return res.data || "";
  } catch (err) {
    logger.warn("[GITLAB] getCiConfig not found:", err.response?.data?.message || err.message);
    return "";
  }
}

export async function listRepoTree(project, gitRef = "main") {
  const client = gitlabClient(project);
  try {
    logger.info(`[GITLAB] Fetching repo tree for ${gitRef}`);
    const res = await client.get(`/projects/${project.gitlabProjectId}/repository/tree`, { params: { ref: gitRef, recursive: true, per_page: 500 } });
    return res.data || [];
  } catch (err) {
    logger.error("[GITLAB] listRepoTree error:", err.response?.data || err.message);
    throw err;
  }
}

export async function fetchFile(project, filePath, gitRef = "main") {
  const client = gitlabClient(project);
  try {
    const encoded = encodeURIComponent(filePath);
    logger.info(`[GITLAB] Fetching file ${filePath}`);
    const res = await client.get(`/projects/${project.gitlabProjectId}/repository/files/${encoded}/raw`, { params: { ref: gitRef }, responseType: "text" });
    return res.data || "";
  } catch (err) {
    logger.warn(`[GITLAB] fetchFile ${filePath} failed:`, err.response?.data || err.message);
    throw err;
  }
}

export async function createBranchForPatch(project, branchName, baseRef = "main") {
  const client = gitlabClient(project);
  try {
    logger.info(`[GITLAB] Creating branch ${branchName}`);
    const res = await client.post(`/projects/${project.gitlabProjectId}/repository/branches`, { branch: branchName, ref: baseRef });
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    if (data?.message === "Branch already exists" || data?.message?.branch) {
      logger.warn("[GITLAB] Branch already exists", branchName);
      return { exists: true };
    }
    logger.error("[GITLAB] createBranchForPatch error:", data || err.message);
    throw err;
  }
}

export async function commitFiles(project, branch, commitMessage, actions = []) {
  const client = gitlabClient(project);
  try {
    logger.info(`[GITLAB] Committing ${actions.length} actions to ${branch}`);
    const res = await client.post(`/projects/${project.gitlabProjectId}/repository/commits`, { branch, commit_message: commitMessage, actions });
    return res.data;
  } catch (err) {
    logger.error("[GITLAB] commitFiles error:", err.response?.data || err.message);
    throw err;
  }
}

export async function createMergeRequest(project, sourceBranch, targetBranch, title, description) {
  const client = gitlabClient(project);
  try {
    logger.info(`[GITLAB] Creating MR ${title}`);
    const res = await client.post(`/projects/${project.gitlabProjectId}/merge_requests`, { source_branch: sourceBranch, target_branch: targetBranch, title, description, remove_source_branch: false });
    return res.data;
  } catch (err) {
    logger.error("[GITLAB] createMergeRequest error:", err.response?.data || err.message);
    throw err;
  }
}

export async function fetchPipelineJobs(project, pipelineId) {
  const client = gitlabClient(project);
  try {
    const res = await client.get(`/projects/${project.gitlabProjectId}/pipelines/${pipelineId}/jobs`);
    return res.data || [];
  } catch (err) {
    logger.error("[GITLAB] fetchPipelineJobs error:", err.response?.data || err.message);
    throw err;
  }
}