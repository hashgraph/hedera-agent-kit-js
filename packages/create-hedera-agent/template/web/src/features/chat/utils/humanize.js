// Generic string helpers used by the substrate's activity / timeline projections
// to render arbitrary tool names and input/output keys readably. Not specific to
// any tool family — extensions use the same helpers indirectly via the default
// summarizer fallback.

const KNOWN_ACRONYMS = new Set(["id", "ids", "nft", "evm", "hbar", "hcs", "hts"]);

export function humanizeToolName(toolName) {
  const cleaned = toolName.replace(/_tool$/i, "").replace(/_/g, " ").trim();
  if (!cleaned) return toolName;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function humanizeKey(key) {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!spaced) return key;
  return spaced
    .split(" ")
    .map((word, idx) => {
      if (KNOWN_ACRONYMS.has(word)) return word.toUpperCase();
      if (idx === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(" ");
}
