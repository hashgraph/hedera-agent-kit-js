import { Context, Configuration } from './configuration';
import { Tool } from './tools';
import { Plugin, PluginRegistry } from './plugin';

export class ToolDiscovery {
  private pluginRegistry = new PluginRegistry();

  constructor(plugins: Plugin[] = []) {
    plugins.forEach(plugin => this.pluginRegistry.register(plugin));
  }

  getAllTools(context: Context, configuration?: Configuration): Tool[] {
    // Get plugin tools
    const pluginTools = this.pluginRegistry.getTools(context);
    if (configuration?.readOnly) {
      this.assertReadOnlyTools(pluginTools);
    }

    // Merge all tools (core tools take precedence in case of name conflicts)
    const allTools: any = [];
    const allToolNames = new Set<string>();

    // Add plugin tools that don't conflict with core tools
    pluginTools.forEach(pluginTool => {
      if (!allToolNames.has(pluginTool.method)) {
        allTools.push(pluginTool);
        allToolNames.add(pluginTool.method);
      } else {
        console.warn(
          `Plugin tool "${pluginTool.method}" conflicts with core tool. Using core tool.`,
        );
      }
    });

    // Apply tool filtering if specified in configuration
    if (configuration?.tools && configuration.tools.length > 0) {
      return allTools.filter((tool: any) => configuration.tools!.includes(tool.method));
    }

    return allTools;
  }

  private assertReadOnlyTools(tools: Tool[]): void {
    const writeTools = tools.filter(tool => !this.isReadOnlyTool(tool));
    if (writeTools.length === 0) {
      return;
    }

    const methods = writeTools.map(tool => tool.method).join(', ');
    throw new Error(`readOnly configuration rejects write-capable tools: ${methods}`);
  }

  private isReadOnlyTool(tool: Tool): boolean {
    return tool.method.startsWith('get_');
  }

  static createFromConfiguration(configuration: Configuration): ToolDiscovery {
    return new ToolDiscovery(configuration.plugins || []);
  }
}
