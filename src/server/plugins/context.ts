import { PluginContext, PluginConfig } from "./types";
import type { PluginManager } from "./manager";

export class PluginContextImpl implements PluginContext {
  config: Record<string, unknown> = {};
  private manager: PluginManager;
  private pluginConfig: PluginConfig;

  constructor(manager: PluginManager, config: PluginConfig) {
    this.manager = manager;
    this.pluginConfig = config;
  }

  on(event: string, handler: (data: any) => void): void {
    this.manager.registerEventHandler(event, handler);
  }

  off(event: string, handler: (data: any) => void): void {
    this.manager.unregisterEventHandler(event, handler);
  }

  async publishData(data: any): Promise<void> {
    // Validate data
    data.id = data.id || `${data.pluginId}-${Date.now()}`;
    await this.manager.publishData(data);
  }

  getService(name: string): any {
    return this.manager.getService(name);
  }

  async setState(key: string, value: any): Promise<void> {
    const state = this.manager.getPluginState(this.pluginConfig.id);
    state.set(key, value);
  }

  async getState<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const state = this.manager.getPluginState(this.pluginConfig.id);
    return (state.get(key) ?? defaultValue) as T | undefined;
  }

  log(message: string): void {
    console.log(`[${this.pluginConfig.id}] ${message}`);
  }

  error(message: string, err?: Error): void {
    console.error(`[${this.pluginConfig.id}] ${message}`, err);
  }
}
