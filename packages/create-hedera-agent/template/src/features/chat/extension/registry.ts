import type {
  ChatExtension,
  SuggestionChip,
  ToolRenderer,
  ToolSummarizer,
} from "./types";

// Merged view of every registered extension. The provider builds one of these
// at mount and on extensions-array change; lookups in components and hooks read
// directly from it without re-merging.
export type ChatExtensionRegistry = {
  toolRenderers: Record<string, ToolRenderer>;
  toolSummarizers: Record<string, ToolSummarizer>;
  suggestions: ReadonlyArray<SuggestionChip>;
  systemPrompt: string;
  // Pre-bound getRequestBody that aggregates every extension's contribution.
  // Substrate forwards this opaquely; collisions warn in development.
  buildRequestBody: () => Record<string, unknown>;
};

// Joiner used when multiple extensions contribute a system prompt. A blank line
// keeps each contribution legible to the LLM without inheriting prior section
// boundaries.
const SYSTEM_PROMPT_SEPARATOR = "\n\n";

// Builds the merged registry. Same merge contract for every slot:
//   • per-tool maps: last writer per tool name wins; collisions warn in dev
//   • suggestions: concatenated in extension order
//   • systemPrompt: non-empty contributions joined with a blank line
//   • getRequestBody: opaque Object.assign in order, collisions warn in dev
export function mergeExtensions(
  extensions: ReadonlyArray<ChatExtension>,
): ChatExtensionRegistry {
  const toolRenderers: Record<string, ToolRenderer> = {};
  const rendererOwners: Record<string, { card?: string; row?: string }> = {};
  const toolSummarizers: Record<string, ToolSummarizer> = {};
  const summarizerOwners: Record<string, string> = {};
  const suggestions: SuggestionChip[] = [];
  const systemPromptParts: string[] = [];

  for (const ext of extensions) {
    if (ext.toolRenderers) {
      for (const [toolName, renderer] of Object.entries(ext.toolRenderers)) {
        mergeToolRenderer(
          toolRenderers,
          rendererOwners,
          toolName,
          renderer,
          ext.id,
        );
      }
    }
    if (ext.toolSummarizers) {
      for (const [toolName, fn] of Object.entries(ext.toolSummarizers)) {
        if (toolSummarizers[toolName]) {
          warnCollision(
            `Tool summarizer "${toolName}" overwritten by extension "${ext.id}" (previous owner: "${summarizerOwners[toolName]}").`,
          );
        }
        toolSummarizers[toolName] = fn;
        summarizerOwners[toolName] = ext.id;
      }
    }
    if (ext.suggestions && ext.suggestions.length > 0) {
      suggestions.push(...ext.suggestions);
    }
    if (typeof ext.systemPrompt === "string" && ext.systemPrompt.length > 0) {
      systemPromptParts.push(ext.systemPrompt);
    }
  }

  const requestBodyContributors = extensions
    .filter((e) => typeof e.getRequestBody === "function")
    .map((e) => ({ id: e.id, get: e.getRequestBody! }));

  const buildRequestBody = (): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};
    const owners: Record<string, string> = {};
    for (const { id, get } of requestBodyContributors) {
      const contribution = get();
      if (!contribution || typeof contribution !== "object") continue;
      for (const [key, value] of Object.entries(contribution)) {
        if (key in merged) {
          warnCollision(
            `Request-body key "${key}" overwritten by extension "${id}" (previous owner: "${owners[key]}").`,
          );
        }
        merged[key] = value;
        owners[key] = id;
      }
    }
    return merged;
  };

  return {
    toolRenderers,
    toolSummarizers,
    suggestions,
    systemPrompt: systemPromptParts.join(SYSTEM_PROMPT_SEPARATOR),
    buildRequestBody,
  };
}

function mergeToolRenderer(
  target: Record<string, ToolRenderer>,
  owners: Record<string, { card?: string; row?: string }>,
  toolName: string,
  renderer: ToolRenderer,
  extensionId: string,
): void {
  const existing = target[toolName] ?? {};
  const existingOwner = owners[toolName] ?? {};
  const next: ToolRenderer = { ...existing };
  const nextOwner = { ...existingOwner };
  if (renderer.card) {
    if (existing.card) {
      warnCollision(
        `Tool card renderer for "${toolName}" overwritten by extension "${extensionId}" (previous owner: "${existingOwner.card}").`,
      );
    }
    next.card = renderer.card;
    nextOwner.card = extensionId;
  }
  if (renderer.row) {
    if (existing.row) {
      warnCollision(
        `Tool row renderer for "${toolName}" overwritten by extension "${extensionId}" (previous owner: "${existingOwner.row}").`,
      );
    }
    next.row = renderer.row;
    nextOwner.row = extensionId;
  }
  target[toolName] = next;
  owners[toolName] = nextOwner;
}

function warnCollision(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[ChatExtensionProvider] ${message}`);
  }
}
