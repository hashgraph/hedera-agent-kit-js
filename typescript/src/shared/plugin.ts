import { Context } from './configuration';
import { Tool } from './tools';
import {
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
} from '@/plugins';

const CORE_PLUGINS = [
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
];

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  tools: (context: Context) => Tool[];
}

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

  private loadCorePlugins(context: Context): Tool[] {
    const pluginTools: Tool[] = [];
    for (const plugin of CORE_PLUGINS) {
      try {
        const tools = plugin.tools(context);
        pluginTools.push(...tools);
      } catch (error) {
        console.error(`Error loading tools from plugin "${plugin.name}":`, error);
      }
    }
    return pluginTools;
  }

  private loadPlugins(context: Context): Tool[] {
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

  getTools(context: Context): Tool[] {
    if (this.plugins.size === 0) {
      return this.loadCorePlugins(context);
    } else {
      return this.loadPlugins(context);
    }
  }

  clear(): void {
    this.plugins.clear();
  }
}
