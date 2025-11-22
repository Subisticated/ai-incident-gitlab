// backend/src/utils/logger.js
export function info(...args) {
  console.log(new Date().toISOString(), "[INFO]", ...args);
}
export function warn(...args) {
  console.warn(new Date().toISOString(), "[WARN]", ...args);
}
export function error(...args) {
  console.error(new Date().toISOString(), "[ERROR]", ...args);
}
export function success(...args) {
  console.log(new Date().toISOString(), "[SUCCESS]", ...args);
}

// Backwards-compatible alias
export const log = info;

const logger = { info, warn, error, success, log };
export default logger;
