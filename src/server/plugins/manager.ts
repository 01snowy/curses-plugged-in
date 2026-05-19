import { IPlugin, PluginContext, PluginConfig, PluginData } from "./types";
import { PluginContextImpl } from "./context";
import CurrentSongPlugin from "./builtin/current-song";
import UniformChatSourcePlugin from "./builtin/uniform-chat-source";
import ChatSourceFilterPlugin from "./builtin/chat-source-filter";

export type PluginStatus = {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  loaded: boolean;
  error?: string;
};

export class PluginManager {
  private plugins = new Map<string, IPlugin>();
  private contexts = new Map<string, PluginContext>();
  private eventHandlers = new Map<string, Array<(data: any) => void>>();
  private pluginConfigs: PluginConfig[] = [];
  private loadErrors = new Map<string, string>();
  private appServices: any;
  private stateStorage: Map<string, Map<string, any>> = new Map();
  private builtinPlugins: Record<string, () => IPlugin> = {
    "current-song": () => new CurrentSongPlugin(),
    "uniform-chat-source": () => new UniformChatSourcePlugin(),
    "chat-source-filter": () => new ChatSourceFilterPlugin(),
  };

  constructor(appServices: any) {
    this.appServices = appServices;
  }

  /**
   * Load plugins from configuration
   */
  async loadPlugins(configs: PluginConfig[]): Promise<void> {
    this.pluginConfigs = configs;

    for (const config of configs) {
      if (!config.enabled) continue;

      try {
        const plugin = await this.loadPlugin(config);
        if (plugin) {
          await this.initializePlugin(plugin, config);
          this.loadErrors.delete(config.id);
        } else {
          this.loadErrors.set(config.id, "Failed to load plugin module");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.loadErrors.set(config.id, msg);
        console.error(`Failed to load plugin ${config.id}:`, error);
      }
    }
  }

  /**
   * Load a single plugin
   */
  private async loadPlugin(config: PluginConfig): Promise<IPlugin | null> {
    try {
      if (config.type === "builtin") {
        const createPlugin = this.builtinPlugins[config.id];
        if (!createPlugin) {
          throw new Error(`Unknown built-in plugin: ${config.id}`);
        }
        return createPlugin();
      } else {
        // Load external plugin from path
        if (!config.path) throw new Error("External plugin missing path");
        const module = await import(/* @vite-ignore */ config.path);
        return new module.default();
      }
    } catch (error) {
      console.error(`Error loading plugin ${config.id}:`, error);
      return null;
    }
  }

  /**
   * Initialize plugin with context
   */
  private async initializePlugin(
    plugin: IPlugin,
    config: PluginConfig
  ): Promise<void> {
    // Create plugin context
    const context = new PluginContextImpl(this, config);

    // Validate plugin config
    const schema = plugin.getConfigSchema();
    const validConfig = schema.parse(config.config);

    // Initialize plugin
    context.config = validConfig;
    this.contexts.set(plugin.id, context);
    this.plugins.set(plugin.id, plugin);

    // Initialize state storage for plugin
    this.stateStorage.set(plugin.id, new Map());

    // Call onInit hook
    await plugin.onInit(context);

    console.log(`Plugin ${plugin.id} initialized`);
  }

  /**
   * Emit event to plugins
   */
  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Publish plugin data to chat box
   */
  async publishData(data: PluginData): Promise<void> {
    this.emit("plugin:data", data);
  }

  on(event: string, handler: (data: any) => void): void {
    this.registerEventHandler(event, handler);
  }

  off(event: string, handler: (data: any) => void): void {
    this.unregisterEventHandler(event, handler);
  }

  getPluginStatuses(): PluginStatus[] {
    return this.pluginConfigs.map((cfg) => {
      const plugin = this.plugins.get(cfg.id);
      const error = this.loadErrors.get(cfg.id);
      return {
        id: cfg.id,
        name: plugin?.name ?? cfg.id,
        version: plugin?.version ?? "?",
        description: plugin?.description,
        enabled: cfg.enabled,
        loaded: !!plugin && !error,
        error: error ?? (cfg.enabled && !plugin ? "Failed to load" : undefined),
      };
    });
  }

  /**
   * Get plugin
   */
  getPlugin(id: string): IPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Destroy all plugins
   */
  async destroy(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.onDestroy();
      } catch (error) {
        console.error(`Error destroying plugin ${plugin.id}:`, error);
      }
    }

    this.plugins.clear();
    this.contexts.clear();
    this.eventHandlers.clear();
    this.stateStorage.clear();
  }

  /**
   * Register event handler (internal)
   */
  registerEventHandler(
    event: string,
    handler: (data: any) => void
  ): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Unregister event handler (internal)
   */
  unregisterEventHandler(
    event: string,
    handler: (data: any) => void
  ): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Get plugin state (internal)
   */
  getPluginState(pluginId: string): Map<string, any> {
    if (!this.stateStorage.has(pluginId)) {
      this.stateStorage.set(pluginId, new Map());
    }
    return this.stateStorage.get(pluginId)!;
  }

  /**
   * Get app service (internal)
   */
  getService(name: string): any {
    return (this.appServices as any)[name];
  }
}
