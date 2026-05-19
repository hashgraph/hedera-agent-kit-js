import { systemPrompt } from "../../../../../shared/agent.js";

export function readSystemPromptTemplate() {
  return systemPrompt;
}

export function renderSystemPrompt(template, variables = {}) {
  return template;
}

export function loadSystemPrompt(variables = {}) {
  return systemPrompt;
}
