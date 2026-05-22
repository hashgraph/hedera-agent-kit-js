// Re-export from the canonical shared module so the CLI runtime, the Node web
// server, and the browser wallet simulator all parse keys identically. See
// `template/shared/operator-key.js` for the curve-resolution strategy.
export { parseOperatorKey, resolveKeyType } from "../../../../../shared/operator-key.js";
