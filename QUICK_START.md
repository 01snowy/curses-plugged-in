# Quick Start Guide - Plugin System

## 📋 What You Got

Your Curses STT app now has a full plugin system! Here's what was added:

### New Files Created
```
src/server/plugins/
├── types.ts              # Plugin interfaces & types
├── manager.ts            # Plugin manager service
├── context.ts            # Plugin context API
├── index.ts              # Barrel export
└── builtin/
    └── current-song.ts   # Example Spotify plugin

src/server/ui/
└── plugin-chatbox.tsx    # Chat box component

plugins.config.json       # Plugin configuration
```

### Documentation Files
- **PLUGIN_SYSTEM_PLAN.md** - Architecture & design
- **FORK_SETUP_GUIDE.md** - Git/GitHub fork instructions  
- **IMPLEMENTATION_ROADMAP.md** - Detailed implementation steps
- **QUICK_START.md** - This file!

## 🚀 5-Minute Setup

### Step 1: Enable the Plugin Manager

Edit `src/server/index.ts` and add:

```typescript
// At the top with other imports
import { PluginManager } from "./plugins";

// In ApiServer class
class ApiServer {
  private pluginManager: PluginManager | null = null;

  constructor() {
    // ... existing code ...
    this.initializePlugins();
  }

  private async initializePlugins(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const configPath = path.resolve("./plugins.config.json");
      const configData = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configData);

      this.pluginManager = new PluginManager({
        stt: this.stt,
        tts: this.tts,
        discord: this.discord,
        twitch: this.twitch,
      });

      await this.pluginManager.loadPlugins(config.plugins);
    } catch (error) {
      console.error("Failed to initialize plugins:", error);
    }
  }

  getPluginManager(): PluginManager | null {
    return this.pluginManager;
  }
}
```

### Step 2: Add Chat Box Component

Edit your main UI component (e.g., `src/client/ui/view.tsx`):

```typescript
import { PluginChatBox } from "@/server/ui/plugin-chatbox";

export const YourComponent = () => {
  const api = useApi(); // Your existing API hook

  return (
    <div>
      {/* Your existing UI */}
      
      {/* Add plugin chat box */}
      <PluginChatBox 
        pluginManager={api.getPluginManager()}
        maxItems={5}
        className="fixed bottom-20 right-4"
      />
    </div>
  );
};
```

### Step 3: Enable Current Song Plugin (Optional)

To show the current song from Spotify:

1. Go to https://developer.spotify.com/dashboard
2. Create an app and get `Client ID` and `Client Secret`
3. Get a refresh token (use [Spotify Auth Flow](https://developer.spotify.com/documentation/web-api/concepts/authorization))
4. Update `plugins.config.json`:

```json
{
  "plugins": [
    {
      "id": "current-song",
      "enabled": true,
      "type": "builtin",
      "config": {
        "spotify": {
          "clientId": "YOUR_CLIENT_ID",
          "clientSecret": "YOUR_CLIENT_SECRET",
          "refreshToken": "YOUR_REFRESH_TOKEN"
        },
        "updateInterval": 3000,
        "displayFormat": "🎵 Now Playing: {artist} - {title}"
      }
    }
  ]
}
```

5. Start your app: `pnpm dev`

That's it! The current song will now display in your chat box every time you play something on Spotify.

## 📝 Common Tasks

### Create a New Plugin

Create `src/server/plugins/builtin/my-plugin.ts`:

```typescript
import { IPlugin, PluginContext } from "../types";
import { z } from "zod";

export default class MyPlugin implements IPlugin {
  id = "my-plugin";
  name = "My Plugin";
  version = "1.0.0";
  description = "My awesome plugin";

  private context: PluginContext | null = null;

  getConfigSchema() {
    return z.object({
      setting1: z.string().default("default_value"),
    });
  }

  async onInit(context: PluginContext): Promise<void> {
    this.context = context;

    // Listen to events
    this.context.on("stt:capture", (data) => {
      console.log("STT captured:", data);
    });

    // Publish data to chat box
    await this.context.publishData({
      id: "my-event-1",
      pluginId: this.id,
      type: "text",
      content: "Hello from my plugin!",
      icon: "👋",
      duration: 5000, // Show for 5 seconds
    });

    this.context.log("Plugin initialized");
  }

  async onDestroy(): Promise<void> {
    this.context?.log("Plugin destroyed");
  }
}
```

Enable it in `plugins.config.json`:

```json
{
  "plugins": [
    {
      "id": "my-plugin",
      "enabled": true,
      "type": "builtin",
      "config": {
        "setting1": "my_value"
      }
    }
  ]
}
```

### Listen to App Events

```typescript
// In your plugin's onInit
this.context.on("stt:capture", (data) => {
  // Your STT was captured
  console.log("Captured:", data.text);
});

this.context.on("chat:message", (data) => {
  // Chat message received
  console.log("Chat:", data.message);
});

this.context.on("scene:changed", (data) => {
  // Scene changed in OBS
  console.log("Scene:", data.sceneName);
});
```

### Access App Services

```typescript
// Get a service
const discordService = this.context.getService("discord");
const sttService = this.context.getService("stt");

// Use the service
await discordService.send("My message");
```

### Store Plugin State

```typescript
// Save state
await this.context.setState("my_key", { data: "persisted" });

// Load state
const data = await this.context.getState("my_key");
console.log(data); // { data: "persisted" }
```

### Log Messages

```typescript
this.context.log("This is a log");        // [my-plugin] This is a log
this.context.error("Error!", new Error()); // [my-plugin] Error! ...
```

## 🔌 Plugin Types

### Text Plugin
Displays simple text messages:

```typescript
await this.context.publishData({
  id: `event-${Date.now()}`,
  pluginId: this.id,
  type: "text",
  content: "Just some text",
  icon: "📝",
  duration: 0, // Show indefinitely
});
```

### Alert Plugin
Displays important alerts:

```typescript
await this.context.publishData({
  id: `alert-${Date.now()}`,
  pluginId: this.id,
  type: "alert",
  content: "Something important!",
  icon: "🚨",
  color: "#FF0000",
  duration: 10000, // Show for 10 seconds
  priority: 10, // Show first
});
```

### Update Plugin
Displays dynamic updates:

```typescript
await this.context.publishData({
  id: `update-${Date.now()}`,
  pluginId: this.id,
  type: "update",
  content: "Status: Active",
  icon: "🔄",
  duration: 0,
  priority: 5,
});
```

## 🌐 Integration Ideas

### Current Song (Spotify)
✅ Already included! See `current-song.ts`

### Weather Updates
Show current weather and forecasts

### Stream Alerts
New follower, new subscriber, raid notifications

### Chat Integrations
- Discord messages
- Twitch chat highlights
- Custom webhooks

### Performance Metrics
- GPU/CPU usage
- Frame rate
- Bitrate

### Custom Alerts
- Keyword triggers
- Time-based announcements
- User activity notifications

## 📚 More Info

- **Full architecture**: See [PLUGIN_SYSTEM_PLAN.md](./PLUGIN_SYSTEM_PLAN.md)
- **Implementation details**: See [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)
- **Fork & deploy**: See [FORK_SETUP_GUIDE.md](./FORK_SETUP_GUIDE.md)

## ❓ Troubleshooting

### Plugin not loading?

1. Check `plugins.config.json` is valid JSON
2. Verify plugin file exists and exports default class
3. Check console for error messages
4. Ensure `enabled: true` in config

### Plugin not showing in chat box?

1. Verify `PluginChatBox` component is rendered
2. Check plugin manager is passed correctly
3. Confirm `publishData()` is called
4. Check browser console for errors

### Performance issues?

1. Reduce `updateInterval` in plugin config
2. Limit number of chat box items (`maxItems`)
3. Check for memory leaks in plugin
4. Use `context.log()` to debug

## 🤝 Next Steps

1. ✅ Read this guide
2. ⬜ Enable one plugin in config
3. ⬜ Test with `pnpm dev`
4. ⬜ Create your own plugin
5. ⬜ Deploy to your fork

---

**Questions?** See the detailed documentation files or review the plugin code examples.

Happy streaming! 🎬
