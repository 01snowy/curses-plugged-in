import { z } from "zod";

/**
 * Plugin interface - all plugins must implement this
 */
export interface IPlugin {
  id: string;
  name: string;
  version: string;
  description: string;

  // Lifecycle hooks
  onInit(context: PluginContext): Promise<void>;
  onDestroy(): Promise<void>;

  // Configuration schema
  getConfigSchema(): z.ZodSchema;
}

/**
 * Plugin context - API plugins use to interact with app
 */
export interface PluginContext {
  config: Record<string, unknown>;

  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;

  // Publish data to chat box
  publishData(data: PluginData): Promise<void>;

  // Access app services
  getService(name: string): any;

  // State management
  setState(key: string, value: any): Promise<void>;
  getState<T>(key: string, defaultValue?: T): Promise<T | undefined>;

  // Logging
  log(message: string): void;
  error(message: string, err?: Error): void;
}

/**
 * Data published by plugins to chat box
 */
export interface PluginData {
  id: string;
  pluginId: string;
  type: "text" | "alert" | "update";
  content: string;
  icon?: string;
  color?: string;
  duration?: number; // milliseconds, 0 = persistent
  priority?: number; // 0-10, higher = display first
}

/**
 * Plugin event types
 */
export enum PluginEventType {
  // App -> Plugin
  STT_CAPTURE = "stt:capture",
  CHAT_MESSAGE = "chat:message",
  SCENE_CHANGED = "scene:changed",
  TIMER_TICK = "timer:tick",

  // Plugin -> Chat Box
  DATA_UPDATE = "plugin:dataUpdate",
  ERROR = "plugin:error",
  ALERT = "plugin:alert",
}

/**
 * Plugin configuration (from plugins.config.json)
 */
export interface PluginConfig {
  id: string;
  enabled: boolean;
  type: "builtin" | "external";
  path?: string; // for external plugins
  config: Record<string, any>;
}

/**
 * Plugin manager state
 */
export interface PluginManagerState {
  plugins: Map<string, IPlugin>;
  contexts: Map<string, PluginContext>;
  eventHandlers: Map<string, Array<(data: any) => void>>;
}

/**
 * Zod schemas for validation
 */
export const PluginConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  type: z.enum(["builtin", "external"]),
  path: z.string().optional(),
  config: z.record(z.any()),
});

export const PluginDataSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  type: z.enum(["text", "alert", "update"]),
  content: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  duration: z.number().optional(),
  priority: z.number().min(0).max(10).optional().default(5),
});

export const PluginsConfigFileSchema = z.object({
  plugins: z.array(PluginConfigSchema),
});
