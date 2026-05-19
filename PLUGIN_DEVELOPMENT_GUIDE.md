# Plugin Development Guide

Complete guide for creating custom plugins for Curses.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│ Your Plugin (IPlugin)                   │
├─────────────────────────────────────────┤
│ onInit()        - Initialization        │
│ onDestroy()     - Cleanup               │
│ getConfigSchema() - Validation          │
└────────┬────────────────────────────────┘
         │
         └─────→ PluginContext
                  ├── on() / off()        - Event subscriptions
                  ├── publishData()       - Send to chat box
                  ├── getService()        - Access app services
                  ├── setState()          - Persist state
                  └── log() / error()     - Logging
```

## Full Plugin Template

Create a new file `src/server/plugins/builtin/your-plugin.ts`:

```typescript
import { IPlugin, PluginContext, PluginEventType } from "../types";
import { z } from "zod";

/**
 * Your Plugin Description
 * 
 * What it does:
 * - Feature 1
 * - Feature 2
 * 
 * Configuration:
 * - option1: description
 * - option2: description
 */
export default class YourPlugin implements IPlugin {
  // Required properties
  id = "your-plugin";
  name = "Your Plugin";
  version = "1.0.0";
  description = "Description of what your plugin does";

  // Internal state
  private context: PluginContext | null = null;
  private eventHandlers: any[] = [];
  private timers: NodeJS.Timeout[] = [];

  /**
   * Define configuration schema with validation
   */
  getConfigSchema() {
    return z.object({
      apiKey: z.string().optional(),
      updateInterval: z.number().default(5000).min(1000),
      displayFormat: z.string().optional(),
      // Add your config options here
    });
  }

  /**
   * Called when plugin is initialized
   * 
   * Do:
   * - Subscribe to events
   * - Start timers/intervals
   * - Load cached state
   * - Connect to external APIs
   * 
   * Don't:
   * - Perform long-running operations
   * - Block the main thread
   */
  async onInit(context: PluginContext): Promise<void> {
    this.context = context;

    // Restore previous state
    const savedState = await this.context.getState("my-state");
    if (savedState) {
      console.log("Restored state:", savedState);
    }

    // Subscribe to app events
    this.subscribeToEvents();

    // Start your plugin logic
    this.startPolling();

    this.context.log("Plugin initialized successfully");
  }

  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    if (!this.context) return;

    // Listen to STT captures
    const sttHandler = (data: any) => {
      this.handleSTTCapture(data);
    };
    this.context.on(PluginEventType.STT_CAPTURE, sttHandler);
    this.eventHandlers.push({ event: PluginEventType.STT_CAPTURE, handler: sttHandler });

    // Listen to chat messages
    const chatHandler = (data: any) => {
      this.handleChatMessage(data);
    };
    this.context.on(PluginEventType.CHAT_MESSAGE, chatHandler);
    this.eventHandlers.push({ event: PluginEventType.CHAT_MESSAGE, handler: chatHandler });

    // Listen to scene changes
    const sceneHandler = (data: any) => {
      this.handleSceneChange(data);
    };
    this.context.on(PluginEventType.SCENE_CHANGED, sceneHandler);
    this.eventHandlers.push({ event: PluginEventType.SCENE_CHANGED, handler: sceneHandler });
  }

  /**
   * Unsubscribe from events
   */
  private unsubscribeFromEvents(): void {
    if (!this.context) return;

    for (const { event, handler } of this.eventHandlers) {
      this.context.off(event, handler);
    }
    this.eventHandlers = [];
  }

  /**
   * Start polling for data
   */
  private startPolling(): void {
    if (!this.context) return;

    const interval = (this.context.config as any).updateInterval;

    const timer = setInterval(() => {
      this.pollData();
    }, interval);

    this.timers.push(timer);
  }

  /**
   * Stop all timers
   */
  private stopPolling(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  /**
   * Handle STT capture events
   */
  private handleSTTCapture(data: any): void {
    // Example: Publish data when STT is captured
    this.context?.publishData({
      id: `${this.id}-stt-${Date.now()}`,
      pluginId: this.id,
      type: "text",
      content: `STT: ${data.text}`,
      icon: "🎤",
      duration: 3000,
    });
  }

  /**
   * Handle chat message events
   */
  private handleChatMessage(data: any): void {
    // Example: React to specific messages
    if (data.message.includes("!mycommand")) {
      this.context?.publishData({
        id: `${this.id}-cmd-${Date.now()}`,
        pluginId: this.id,
        type: "alert",
        content: "Command executed!",
        icon: "⚡",
        duration: 5000,
      });
    }
  }

  /**
   * Handle scene change events
   */
  private handleSceneChange(data: any): void {
    this.context?.log(`Scene changed to: ${data.sceneName}`);
  }

  /**
   * Poll for new data
   */
  private async pollData(): Promise<void> {
    if (!this.context) return;

    try {
      // Example: Fetch data from external source
      const data = await this.fetchData();

      if (data) {
        // Publish to chat box
        await this.context.publishData({
          id: `${this.id}-poll-${Date.now()}`,
          pluginId: this.id,
          type: "update",
          content: data,
          icon: "🔄",
          priority: 5,
        });

        // Save state for persistence
        await this.context.setState("last-data", data);
      }
    } catch (error) {
      this.context.error("Error polling data", error as Error);
    }
  }

  /**
   * Fetch data from external source
   */
  private async fetchData(): Promise<string | null> {
    // Example: Call external API
    try {
      const response = await fetch("https://api.example.com/data");
      if (!response.ok) return null;

      const data = await response.json();
      return data.formatted || null;
    } catch (error) {
      this.context?.error("Failed to fetch data", error as Error);
      return null;
    }
  }

  /**
   * Publish alert to chat box
   */
  private async publishAlert(message: string): Promise<void> {
    if (!this.context) return;

    await this.context.publishData({
      id: `${this.id}-alert-${Date.now()}`,
      pluginId: this.id,
      type: "alert",
      content: message,
      icon: "🚨",
      color: "#FF0000",
      duration: 10000,
      priority: 10,
    });
  }

  /**
   * Called when plugin is destroyed
   * 
   * Do:
   * - Cleanup timers
   * - Unsubscribe from events
   * - Close API connections
   * - Save state
   * 
   * Don't:
   * - Leave cleanup incomplete
   * - Forget to clear timers (memory leak!)
   */
  async onDestroy(): Promise<void> {
    // Cleanup
    this.unsubscribeFromEvents();
    this.stopPolling();

    // Save state before shutdown
    await this.context?.setState("plugin-state", {
      lastUpdated: Date.now(),
    });

    this.context?.log("Plugin destroyed cleanly");
  }
}
```

## Configuration Schema with Zod

Use Zod for config validation:

```typescript
getConfigSchema() {
  return z.object({
    // String
    apiKey: z.string().min(1, "API key required"),
    
    // Optional string
    apiSecret: z.string().optional(),
    
    // Number with range
    updateInterval: z.number()
      .min(1000, "Minimum 1 second")
      .max(60000, "Maximum 60 seconds")
      .default(5000),
    
    // Enum
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    
    // Boolean
    enabled: z.boolean().default(true),
    
    // Array
    keywords: z.array(z.string()).default(["keyword1", "keyword2"]),
    
    // Nested object
    credentials: z.object({
      username: z.string(),
      password: z.string(),
    }).optional(),
    
    // Union type
    source: z.union([
      z.literal("spotify"),
      z.literal("soundcloud"),
      z.literal("local"),
    ]).default("spotify"),
  });
}
```

## Publishing Data to Chat Box

### Different Data Types

```typescript
// Text message
await this.context.publishData({
  id: "unique-id",
  pluginId: this.id,
  type: "text",
  content: "Regular message",
  icon: "💬",
  duration: 5000,  // Show for 5 seconds then disappear
  priority: 5,      // 0-10, higher displays first
});

// Alert
await this.context.publishData({
  id: "alert-id",
  pluginId: this.id,
  type: "alert",
  content: "Important alert!",
  icon: "🚨",
  color: "#FF0000",    // Custom color
  duration: 10000,     // Show longer for alerts
  priority: 10,        // Show first
});

// Status update
await this.context.publishData({
  id: "update-id",
  pluginId: this.id,
  type: "update",
  content: "Status changed",
  icon: "🔄",
  duration: 0,         // Persist indefinitely
  priority: 5,
});
```

### Formatting Tips

```typescript
// Use emojis for visual clarity
const emojis = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  music: "🎵",
  user: "👤",
};

// Template strings
const format = (artist: string, song: string) =>
  `🎵 ${artist} - ${song}`;

// Concatenation
const content = [
  "📊 Status",
  "Active users: 42",
  "Uptime: 12h 34m",
].join("\n");
```

## Event Subscription Patterns

### React to STT Capture

```typescript
this.context.on(PluginEventType.STT_CAPTURE, (data) => {
  console.log("Captured text:", data.text);
  console.log("Confidence:", data.confidence);
  
  // Respond with plugin data
  if (data.text.includes("!command")) {
    // Execute command
  }
});
```

### React to Chat Messages

```typescript
this.context.on(PluginEventType.CHAT_MESSAGE, (data) => {
  console.log("Source:", data.source); // "twitch", "discord", etc
  console.log("User:", data.user);
  console.log("Message:", data.message);
  
  // Check for keywords
  if (data.message.toLowerCase().includes("hello")) {
    // Respond
  }
});
```

### React to Scene Changes

```typescript
this.context.on(PluginEventType.SCENE_CHANGED, (data) => {
  console.log("New scene:", data.sceneName);
  
  // Change plugin behavior based on scene
  if (data.sceneName === "gameplay") {
    // Disable notifications
  } else {
    // Enable notifications
  }
});
```

### React to Timer Ticks

```typescript
this.context.on(PluginEventType.TIMER_TICK, (data) => {
  // Called every second
  console.log("Elapsed:", data.elapsed); // milliseconds
});
```

## State Management

```typescript
// Save state
await this.context.setState("key", value);

// Load state
const value = await this.context.getState("key");

// Load with default
const value = await this.context.getState("key", "default");

// Example: Track user interactions
await this.context.setState("user-interactions", {
  clicks: 42,
  lastClick: Date.now(),
});

// Load and update
const state = await this.context.getState("user-interactions", {});
state.clicks = (state.clicks || 0) + 1;
await this.context.setState("user-interactions", state);
```

## Accessing App Services

```typescript
// Get services
const stt = this.context.getService("stt");
const tts = this.context.getService("tts");
const discord = this.context.getService("discord");
const twitch = this.context.getService("twitch");

// Use services
if (stt) {
  // Start STT
}

if (discord) {
  // Send Discord message
  await discord.send("Hello from plugin!");
}

if (twitch) {
  // Interact with Twitch
}
```

## Error Handling

```typescript
async onInit(context: PluginContext): Promise<void> {
  this.context = context;

  try {
    // Your code
    const result = await this.fetchData();
  } catch (error) {
    // Log error
    this.context.error("Failed to fetch data", error as Error);
    
    // Publish error alert
    await this.context.publishData({
      id: `error-${Date.now()}`,
      pluginId: this.id,
      type: "alert",
      content: "Plugin error occurred",
      icon: "❌",
      duration: 10000,
    });
  }
}
```

## Common Patterns

### Debouncing Updates

```typescript
private lastUpdate = 0;
private readonly MIN_UPDATE_INTERVAL = 5000; // 5 seconds

private async maybePublish(data: any): Promise<void> {
  const now = Date.now();
  if (now - this.lastUpdate < this.MIN_UPDATE_INTERVAL) {
    return;
  }
  this.lastUpdate = now;
  await this.context?.publishData(data);
}
```

### Caching Results

```typescript
private cache: Map<string, { value: any; expiry: number }> = new Map();

private async getCachedOrFetch(
  key: string,
  ttl: number,
  fetcher: () => Promise<any>
): Promise<any> {
  const cached = this.cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  const value = await fetcher();
  this.cache.set(key, { value, expiry: Date.now() + ttl });
  return value;
}
```

### Retry Logic

```typescript
private async retryFetch(
  url: string,
  maxRetries: number = 3
): Promise<Response | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  return null;
}
```

## Testing Your Plugin

```typescript
// Create a mock context
const mockContext: PluginContext = {
  on: jest.fn(),
  off: jest.fn(),
  publishData: jest.fn(),
  getService: jest.fn(),
  setState: jest.fn(),
  getState: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  config: {},
};

// Test initialization
const plugin = new YourPlugin();
await plugin.onInit(mockContext);

// Verify publishData was called
expect(mockContext.publishData).toHaveBeenCalled();
```

## Deployment

1. Create your plugin file in `src/server/plugins/builtin/`
2. Add config to `plugins.config.json`
3. Test locally with `pnpm dev`
4. Commit and push to your fork
5. Open PR to main repo (if contributing)

## Publishing to npm (Advanced)

Create an external plugin as npm package:

```typescript
// my-plugin/src/index.ts
export default class MyExternalPlugin implements IPlugin {
  // ... your plugin code
}
```

Configure in `plugins.config.json`:

```json
{
  "plugins": [
    {
      "id": "my-external-plugin",
      "enabled": true,
      "type": "external",
      "path": "node_modules/my-plugin-package/dist/index.js",
      "config": {}
    }
  ]
}
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Curses Documentation](./README.md)
- [Plugin System Architecture](./PLUGIN_SYSTEM_PLAN.md)

---

**Ready to build?** Start with the template and customize for your needs!
