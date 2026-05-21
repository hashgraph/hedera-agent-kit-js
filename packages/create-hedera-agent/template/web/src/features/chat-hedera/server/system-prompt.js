import { systemPrompt } from "../../../../../shared/config.js";

export function readSystemPromptTemplate() {
  return systemPrompt;
}

export function renderSystemPrompt(template, variables = {}) {
  return template;
}

export function loadSystemPrompt(variables = {}) {
  return systemPrompt;
}
