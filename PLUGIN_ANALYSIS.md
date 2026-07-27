# Plugin Analysis: nowPlaying & uniformChat

## 1. FILE PATHS AND STRUCTURE

### nowPlaying Plugin/Service

**Main Implementation:**
- **Service**: `src/server/services/nowPlaying/index.ts` - Core service implementation
- **Schema**: `src/server/services/nowPlaying/schema.ts` - State type definitions
- **Plugin Wrapper**: `src/server/plugins/builtin/current-song.ts` - Plugin interface wrapper
- **Native Bridge**: `src-tauri/src/services/now_playing/mod.rs` - Rust backend for Windows media detection
- **UI Component**: `src/server/ui/inspector/inspector_plugins.tsx` → `NowPlayingSettings` component
- **Configuration**: `plugins.config.json` - Plugin configuration file

**Directory Structure:**
```
src/server/services/nowPlaying/
├── index.ts          (Main service class)
└── schema.ts         (State schema and types)

src/server/plugins/builtin/
└── current-song.ts   (Plugin wrapper)

src-tauri/src/services/
└── now_playing/
    └── mod.rs        (Rust backend)
```

### uniformChat Plugin

**Main Implementation:**
- **Plugin**: `src/server/plugins/builtin/uniform-chat-source.ts` - Main plugin implementation
- **Schema**: Part of `src/server/schema.ts` → `PluginSettingsSchema.uniformChatSource`
- **UI Component**: `src/server/ui/inspector/inspector_plugins.tsx` → `UniformChatSourcePluginSettings` component
- **Configuration**: `plugins.config.json` - Plugin configuration file

---

## 2. CURRENT FEATURES AND SETTINGS

### nowPlaying Service Features

#### Core Functionality:
- **Multi-source track fetching:**
  - Spotify API integration (with OAuth token refresh)
  - Windows Media Transport Controls (native Windows music detection)
  - Fallback to local system media
  
- **Display Management:**
  - Custom message formatting with placeholders: `{artist}`, `{title}`, `{album}`
  - Default format: `"🎵 Now Playing: {artist} - {title}"`
  - Hides during speech/STT to avoid conflicts
  - Auto-restore after configurable delay
  
- **Integration:**
  - Send to VRChat via OSC chatbox
  - Send to OBS captions/text sources
  - Register as `TextEventSource.nowPlaying` for pubsub system
  - Polls at configurable intervals

#### Settings/Configuration:
```typescript
{
  enable: boolean (default: true)
  displayFormat: string (default: "🎵 Now Playing: {artist} - {title}")
  updateInterval: number (default: 3000ms, min: 1000ms)
  sendToVrc: boolean (default: true)
  sendToCaptions: boolean (default: true)
  hideDelayMs: number (default: 5000ms, min: 500ms)
  spotify: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }
}
```

#### Internal Features:
- Token caching for Spotify with expiry tracking
- Duplicate track detection to avoid redundant updates
- Speech suppression: hides now playing when user is speaking
- Automatic retry scheduling with configurable delays

---

### uniformChat Plugin Features

#### Core Functionality:
- **Unified Text Source Aggregation:**
  - Combines multiple text input sources into single `TextEventSource.chat` output
  - Supports sources:
    - Speech-to-text (STT)
    - Translation
    - Text field / Twitch chat input
    - Now playing (Spotify)
  
- **Message Processing Pipeline:**
  - Optional whitespace collapsing (collapse multiple spaces to one)
  - Optional trimming (remove leading/trailing whitespace)
  - Optional interim message filtering (only pass final messages)
  - Optional empty message filtering (ignore blank final messages)
  
- **Message Formatting:**
  - Customizable format with tokens:
    - `{message}` - The text content
    - `{source}` - Human-readable source label
    - `{topic}` - Raw source identifier
    - `{type}` - Event type (final/interim)
  
- **Intelligent Polling:**
  - Automatically polls nowPlaying service when it's enabled as a source
  - Uses nowPlaying's configured poll interval
  - Duplicate detection for nowPlaying (prevents repeated songs)

#### Settings/Configuration:
```typescript
{
  sources: TextEventSource[] (default: [stt, translation, textfield, nowPlaying])
  messageFormat: string (default: "{message}")
  includeInterim: boolean (default: true)
  collapseWhitespace: boolean (default: true)
  trim: boolean (default: true)
  ignoreEmptyFinal: boolean (default: true)
  manualSource: TextEventSource (default: textfield)
  manualMessage: string (default: "")
}
```

#### Internal Features:
- Source change detection (tracks hash of active sources)
- Dynamic subscription management (subscribes/unsubscribes based on config)
- Settings mutation watching (auto-updates when UI changes)
- Last published value tracking (duplicate detection per-source)
- Smart nowPlaying polling (starts/stops based on source selection)

---

## 3. HOW THEY'RE CONFIGURED

### Plugin Configuration File: `plugins.config.json`

```json
{
  "plugins": [
    {
      "id": "current-song",
      "enabled": true,
      "type": "builtin",
      "config": {
        "spotify": {
          "clientId": "",
          "clientSecret": "",
          "refreshToken": ""
        },
        "updateInterval": 3000,
        "displayFormat": "🎵 Now Playing: {artist} - {title}"
      }
    },
    {
      "id": "uniform-chat-source",
      "enabled": true,
      "type": "builtin",
      "config": {
        "sources": [
          "text.stt",
          "text.translation",
          "text.textfield",
          "text.nowPlaying"
        ],
        "messageFormat": "{message}",
        "includeInterim": true,
        "collapseWhitespace": true,
        "trim": true,
        "ignoreEmptyFinal": true
      }
    }
  ]
}
```

### Runtime Configuration Flow

#### nowPlaying:
1. **Schema Validation** (`Service_NowPlaying_Schema` in schema.ts)
2. **State Initialization** via `window.ApiServer.state.services.nowPlaying.data`
3. **Plugin Init** → `CurrentSongPlugin.onInit()` calls `Service_NowPlaying.configure()`
4. **Dynamic Updates** via UI mutations trigger `Service_NowPlaying.refresh()`

#### uniformChat:
1. **Schema Validation** (`PluginSettingsSchema.uniformChatSource`)
2. **Plugin Init** → `UniformChatSourcePlugin.onInit()` reads settings
3. **Dynamic Updates** via Valtio subscription to `window.ApiServer.state.plugins.uniformChatSource`
4. **Source Re-subscription** on config changes (detected via `getSourcesKey()`)

### Zod Schemas

**nowPlaying Schema** (`src/server/services/nowPlaying/schema.ts`):
```typescript
Service_NowPlaying_Schema = {
  enable: boolean (coerced)
  displayFormat: string
  updateInterval: number (coerced)
  sendToVrc: boolean (coerced)
  sendToCaptions: boolean (coerced)
  hideDelayMs: number (coerced)
  spotify: { clientId, clientSecret, refreshToken } (optional)
}
```

**uniformChat Schema** (`src/server/schema.ts`):
```typescript
PluginSettingsSchema.uniformChatSource = {
  sources: TextEventSource[] (with defaults)
  messageFormat: string
  includeInterim: boolean (coerced)
  collapseWhitespace: boolean (coerced)
  trim: boolean (coerced)
  ignoreEmptyFinal: boolean (coerced)
  manualSource: TextEventSource
  manualMessage: string
}
```

---

## 4. EXISTING UI COMPONENTS

### nowPlaying UI: `NowPlayingSettings` Component

**Location**: `src/server/ui/inspector/inspector_plugins.tsx` (lines 27-115)

**Component Structure:**
```tsx
<NowPlayingSettings>
  ├─ InputCheckbox "Enable now playing"
  │  └─ Triggers: window.ApiServer.nowPlaying.start()/stop()
  │
  ├─ InputText "Message ({artist}, {title}, {album})"
  │  └─ Format string editor
  │
  ├─ InputText "Poll interval (ms)"
  │  └─ Min: 1000ms, default: 3000ms
  │  └─ Triggers: window.ApiServer.nowPlaying.start()
  │
  ├─ InputText "Show again after speech (ms)"
  │  └─ Min: 500ms, default: 5000ms
  │
  ├─ InputCheckbox "Send to VRChat chatbox (OSC final)"
  │  └─ Toggle VRC integration
  │
  ├─ InputCheckbox "Send to OBS captions"
  │  └─ Toggle caption/text source integration
  │
  ├─ InputText "Spotify client ID"
  │  └─ Text input (unmasked)
  │
  ├─ InputText "Spotify client secret"
  │  └─ Password field
  │
  ├─ InputText "Spotify refresh token"
  │  └─ Password field
  │
  └─ Help text: "Hidden during STT and chat. Use a text element..."
```

**Rendering Logic:**
- Conditional render: `{plugin.id === "current-song" && plugin.loaded && <NowPlayingSettings />}`
- Uses Valtio snapshot for reactive updates
- Animation: Framer Motion slide-in on mount

**State Updates:**
- Uses `window.ApiServer.patchService("nowPlaying", callback)`
- Calls `window.ApiServer.nowPlaying.refresh()` on input changes

---

### uniformChat UI: `UniformChatSourcePluginSettings` Component

**Location**: `src/server/ui/inspector/inspector_plugins.tsx` (lines 130-209)

**Component Structure:**
```tsx
<UniformChatSourcePluginSettings>
  ├─ InputText "Message format"
  │  └─ Editable format string
  │
  ├─ Help text: "Tokens: {message}, {source}, {topic}, {type}"
  │
  ├─ InputCheckbox[] "Source toggles"
  │  ├─ Speech to text
  │  ├─ Translation
  │  ├─ Text field / Twitch chat
  │  └─ Now playing / Spotify
  │  └─ Multiple selections allowed
  │
  ├─ InputCheckbox "Forward interim messages"
  │  └─ Include TextEventType.interim in output
  │
  ├─ InputCheckbox "Trim message"
  │  └─ Remove leading/trailing whitespace
  │
  ├─ InputCheckbox "Collapse whitespace"
  │  └─ Replace multiple spaces with single space
  │
  ├─ InputCheckbox "Ignore empty final messages"
  │  └─ Filter out blank final messages
  │
  └─ Manual Testing Section:
     ├─ InputSelect "Send as source"
     │  └─ Options: [STT, Translation, Text field, Now playing, Unified chat]
     │
     ├─ InputText "Text to send"
     │  └─ Manual text input field
     │
     └─ Button "Send text"
        └─ Publishes to selected source
```

**Rendering Logic:**
- Conditional render: `{plugin.id === "uniform-chat-source" && plugin.loaded && <UniformChatSourcePluginSettings />}`
- Dynamic checkboxes mapped from `sourceOptions` array
- Uses Valtio snapshot for reactive updates
- Animation: Framer Motion slide-in on mount

**State Updates:**
- Direct mutations: `window.ApiServer.state.plugins.uniformChatSource[key] = value`
- No service calls needed; Valtio observers handle updates

**Helper Functions:**
- `toggleSource(source, enabled)` - Adds/removes source from array
- `sendManualText()` - Publishes test message via pubsub

---

## 5. INTEGRATION POINTS

### nowPlaying Integration:

1. **Services:**
   - `window.ApiServer.nowPlaying.start()` - Start polling
   - `window.ApiServer.nowPlaying.stop()` - Stop polling
   - `window.ApiServer.nowPlaying.refresh()` - Force refresh
   - `window.ApiServer.nowPlaying.configure()` - Set Spotify creds
   - `window.ApiServer.nowPlaying.publishCurrentToTextSource()` - Manual publish

2. **State Listeners:**
   - VRChat service for OSC output
   - OBS text source via pubsub
   - Speech handlers (STT, translation, textfield)

3. **External APIs:**
   - Spotify API (`api.spotify.com/v1/me/player/currently-playing`)
   - Windows Media Transport Controls (Tauri bridge)

---

### uniformChat Integration:

1. **Pubsub System:**
   - Subscribes to: STT, Translation, Text field, nowPlaying sources
   - Publishes to: `TextEventSource.chat`
   - Registers as unified chat event for other listeners

2. **Plugin Context:**
   - State storage: `setState("last-source", eventName)`
   - Logging: `context.log()`
   - Config reading: `context.config`

3. **Dynamic Polling:**
   - Calls `window.ApiServer.nowPlaying.publishCurrentToTextSource()`
   - Uses nowPlaying's update interval as polling rate

---

## 6. KEY DEPENDENCIES

### nowPlaying:
- Tauri API (`@tauri-apps/api/tauri`)
- Spotify OAuth 2.0
- Windows Media Transport Controls (native)
- OBS/VRChat OSC integration

### uniformChat:
- Valtio (state management)
- Pubsub system (internal event bus)
- TextEventSource enum for type safety

---

## 7. CONFIGURATION EXAMPLES

### Enable Spotify Now Playing:

```json
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
    "displayFormat": "🎵 {artist} - {title} from {album}"
  }
}
```

### Custom Message Format:

```json
{
  "id": "uniform-chat-source",
  "enabled": true,
  "type": "builtin",
  "config": {
    "sources": ["text.stt", "text.nowPlaying"],
    "messageFormat": "[{source}] {message}",
    "includeInterim": false,
    "trim": true,
    "collapseWhitespace": true
  }
}
```

