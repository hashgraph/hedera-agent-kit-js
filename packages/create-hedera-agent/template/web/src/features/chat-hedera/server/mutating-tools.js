// Buckets tool methods into mutating vs read-only based on the plugin's name.
// Hedera Agent Kit plugins follow the convention `core-*-query-plugin` for read
// plugins and `core-*-plugin` for mutating plugins. Anything coming out of a
// query-named plugin executes server-side without an approval gate; everything
// else routes through the HITL approval card in `human` mode.
export function getMutatingToolMethods(plugins) {
  const methods = new Set();
  for (const plugin of plugins) {
    if (isQueryPlugin(plugin)) continue;
    const tools = plugin.tools({});
    for (const tool of tools) {
      methods.add(tool.method);
    }
  }
  return methods;
}

export function isMutatingTool(toolName, plugins) {
  return getMutatingToolMethods(plugins).has(toolName);
}

function isQueryPlugin(plugin) {
  return /(^|-)query(-|$)/i.test(plugin.name);
}
