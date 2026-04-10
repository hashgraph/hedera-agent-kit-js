import { Context } from './configuration';
import { Tool } from './tools';

export type Plugin = {
  name: string;
  version?: string;
  description?: string;
  tools: (context: Context) => Tool[];
};

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already registered. Overwriting.`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getTools(context: Context): Tool[] {
    const pluginTools: Tool[] = [];
    for (const plugin of this.plugins.values()) {
      try {
        const tools = plugin.tools(context);
        pluginTools.push(...tools);
      } catch (error) {
        console.error(`Error loading tools from plugin "${plugin.name}":`, error);
      }
    }
    return pluginTools;
  }

  clear(): void {
    this.plugins.clear();
  }
}
