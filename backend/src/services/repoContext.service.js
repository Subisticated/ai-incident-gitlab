// backend/src/services/repoContext.service.js
import { listRepoTree, fetchFile } from "./gitlab.service.js";
import logger from "../utils/logger.js";

/**
 * Fetch repository snapshot dynamically (no hard-coded files).
 * Returns { files: [{path, content}], primaryFileContent, targetFiles: [paths] }
 */
export async function getRepoSnapshot(project, gitRef = "main") {
  logger.info("[REPO] Fetching repo snapshot for", project.gitlabProjectId, gitRef);
  try {
    const tree = await listRepoTree(project, gitRef);
    if (!Array.isArray(tree)) return { files: [], primaryFileContent: "", targetFiles: [] };

    const files = [];
    for (const node of tree) {
      if (node.type !== "blob") continue;
      if (!node.path) continue;
      try {
        const content = await fetchFile(project, node.path, gitRef);
        // skip very large files
        if (content && content.length < 200_000) files.push({ path: node.path, content });
      } catch (e) {
        logger.debug("[REPO] skip file fetch error:", node.path, e.message);
        continue;
      }
      if (files.length >= 1000) break; // safety cap
    }

    const primary = files.find(f => f.path === ".gitlab-ci.yml");
    logger.info(`[REPO] Collected ${files.length} files`);
    return { files, primaryFileContent: primary ? primary.content : "", targetFiles: files.map(f => f.path) };
  } catch (err) {
    logger.error("[REPO] fetchRepoSnapshot error:", err.message);
    return { files: [], primaryFileContent: "", targetFiles: [] };
  }
}
