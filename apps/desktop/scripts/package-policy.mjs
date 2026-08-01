const forbidden = [
  /^(?:apps|packages|src|test)\//i,
  /^node_modules\/@iris\/[^/]+\/src\//i,
  /^node_modules\/@iris\/[^/]+\/test\//i,
  /^node_modules\/@iris\/[^/]+\/tsconfig[^/]*\.json$/i,
  /(^|\/)\.env(?:\.|$)/i,
];

export function normalizePackagedPath(entry) {
  return entry.replace(/^[/\\]+/, "").replaceAll("\\", "/");
}

export function archiveExtractionPath(entry) {
  return entry.replace(/^[/\\]+/, "");
}

export function isForbiddenPackagedPath(entry) {
  return forbidden.some((pattern) => pattern.test(normalizePackagedPath(entry)));
}
