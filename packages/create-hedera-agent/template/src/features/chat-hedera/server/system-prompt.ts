import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SystemPromptVariables = {
  operatorId?: string;
  network?: string;
  mode?: string;
};

const SUPPORTED_VARIABLES = ["operatorId", "network", "mode"] as const;

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

const PROMPT_PATH = join(process.cwd(), "prompts", "system.md");

export function readSystemPromptTemplate(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function renderSystemPrompt(
  template: string,
  variables: SystemPromptVariables = {},
): string {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (match, name) => {
    if (!isSupported(name)) return match;
    const value = variables[name as (typeof SUPPORTED_VARIABLES)[number]];
    return value ?? "";
  });
}

export function loadSystemPrompt(variables: SystemPromptVariables = {}): string {
  return renderSystemPrompt(readSystemPromptTemplate(), variables);
}

function isSupported(name: string): name is (typeof SUPPORTED_VARIABLES)[number] {
  return (SUPPORTED_VARIABLES as readonly string[]).includes(name);
}
