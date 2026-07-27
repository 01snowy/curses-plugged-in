import { FC, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MdCheckCircle, MdError, MdRefresh } from "react-icons/md";
import SimpleBar from "simplebar-react";
import classNames from "classnames";
import { useSnapshot } from "valtio";
import { InputCheckbox, InputSelect, InputText } from "./components/input";
import { PluginSection, SettingGroup, HelpBox, TokenDisplay, SettingRow } from "./components/plugin-section";
import { NowPlaying_State } from "../../services/nowPlaying/schema";
import { TextEventSource, TextEventType } from "@/types";
import {
  ChatSourceFilterSettings as ChatSourceFilterSettingsState,
  UniformChatSourceSettings as UniformChatSourceSettingsState,
} from "@/server/schema";
import { documentDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/api/shell";

interface PluginItemUI {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  loaded: boolean;
  error?: string;
}

// Helper component for collapsible sections
const Section: FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ 
  title, 
  children, 
  defaultOpen = true 
}) => {
  return <PluginSection title={title} defaultOpen={defaultOpen}>{children}</PluginSection>;
};

const NowPlayingSettings: FC = () => {
  const state = useSnapshot(window.ApiServer.state.services.nowPlaying.data);
  const up = <K extends keyof NowPlaying_State>(key: K, v: NowPlaying_State[K]) => {
    window.ApiServer.patchService("nowPlaying", (s) => {
      s.data[key] = v;
    });
    window.ApiServer.nowPlaying.refresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3 pt-2"
    >
      {/* Main Enable Toggle */}
      <div className="bg-base-200/50 p-2 rounded-lg">
        <InputCheckbox
          label="Enable now playing display"
          value={state.enable}
          onChange={(e) => {
            up("enable", e);
            e ? window.ApiServer.nowPlaying.start() : window.ApiServer.nowPlaying.stop();
          }}
        />
        <p className="text-[10px] text-base-content/60 mt-1 ml-6">
          Display current playing song with customizable format and auto-hide during speech
        </p>
      </div>

      {/* Display Settings */}
      <Section title="Display Format">
        <InputText
          label="Message template"
          value={state.displayFormat}
          placeholder="{artist} - {title}"
          onChange={(e) => up("displayFormat", e.target.value)}
        />
        <p className="text-[10px] text-base-content/60">
          Available tokens: <code className="bg-base-200 px-1 rounded">{"{artist}"}</code>, 
          <code className="bg-base-200 px-1 rounded ml-1">{"{title}"}</code>, 
          <code className="bg-base-200 px-1 rounded ml-1">{"{album}"}</code>
        </p>
        <InputText
          label="Poll interval"
          type="number"
          min={1000}
          value={String(state.updateInterval)}
          onChange={(e) => {
            up("updateInterval", parseInt(e.target.value, 10) || 3000);
            window.ApiServer.nowPlaying.start();
          }}
        />
        <p className="text-[10px] text-base-content/60">
          How often to check for song changes (milliseconds). Higher values reduce CPU usage.
        </p>
        <InputText
          label="Resume after speech"
          type="number"
          min={500}
          value={String(state.hideDelayMs)}
          onChange={(e) => up("hideDelayMs", parseInt(e.target.value, 10) || 5000)}
        />
        <p className="text-[10px] text-base-content/60">
          Milliseconds to wait after you stop speaking before showing the song again
        </p>
      </Section>

      {/* Output Destinations */}
      <Section title="Send To" defaultOpen={true}>
        <div className="space-y-2">
          <InputCheckbox
            label="VRChat chatbox (OSC)"
            value={state.sendToVrc}
            onChange={(e) => up("sendToVrc", e)}
          />
          <p className="text-[10px] text-base-content/60 ml-6">
            Send via OSC to VRChat for display in the chatbox
          </p>
        </div>
        <div className="space-y-2">
          <InputCheckbox
            label="OBS captions"
            value={state.sendToCaptions}
            onChange={(e) => up("sendToCaptions", e)}
          />
          <p className="text-[10px] text-base-content/60 ml-6">
            Send to OBS for display as captions/text source
          </p>
        </div>
      </Section>

      {/* Spotify Configuration */}
      <Section title="Spotify Configuration" defaultOpen={false}>
        <p className="text-[10px] text-base-content/70 mb-2">
          Set up Spotify API credentials to display currently playing music. 
          Get these from <code className="bg-base-200 px-1 rounded text-[9px]">developer.spotify.com/dashboard</code>
        </p>
        <InputText
          label="Client ID"
          value={state.spotify.clientId}
          placeholder="Your Spotify Client ID"
          onChange={(e) =>
            up("spotify", { ...state.spotify, clientId: e.target.value })
          }
        />
        <InputText
          label="Client Secret"
          type="password"
          value={state.spotify.clientSecret}
          placeholder="Your Spotify Client Secret"
          onChange={(e) =>
            up("spotify", { ...state.spotify, clientSecret: e.target.value })
          }
        />
        <InputText
          label="Refresh Token"
          type="password"
          value={state.spotify.refreshToken}
          placeholder="Your Spotify Refresh Token"
          onChange={(e) =>
            up("spotify", { ...state.spotify, refreshToken: e.target.value })
          }
        />
        <p className="text-[10px] text-base-content/60">
          Keep these credentials private and secure. They allow the app to access your Spotify account.
        </p>
      </Section>

      {/* Usage Tips */}
      <div className="bg-base-200/30 p-2 rounded text-[10px] text-base-content/60">
        <p className="font-semibold mb-1">💡 How to use:</p>
        <p>1. Create a text element in your scene with source set to "Now playing"</p>
        <p>2. Disable animations on that element for cleaner transitions</p>
        <p>3. The song hides automatically when you're speaking and shows again afterward</p>
      </div>
    </motion.div>
  );
};

const sourceOptions = [
  { label: "Speech to text", value: TextEventSource.stt },
  { label: "Translation", value: TextEventSource.translation },
  { label: "Text field / Twitch chat", value: TextEventSource.textfield },
  { label: "Now playing / Spotify", value: TextEventSource.nowPlaying },
];

const manualSourceOptions = [
  ...sourceOptions,
  { label: "Unified chat", value: TextEventSource.chat },
];

const logSourceOptions = [
  ...manualSourceOptions,
];

const UniformChatSourcePluginSettings: FC = () => {
  const state = useSnapshot(window.ApiServer.state.plugins.uniformChatSource);
  const up = <K extends keyof UniformChatSourceSettingsState>(
    key: K,
    value: UniformChatSourceSettingsState[K]
  ) => {
    window.ApiServer.state.plugins.uniformChatSource[key] = value;
  };

  const toggleSource = (source: TextEventSource, enabled: boolean) => {
    const sources = Array.from(state.sources) as TextEventSource[];
    up(
      "sources",
      enabled
        ? Array.from(new Set([...sources, source]))
        : sources.filter((value) => value !== source)
    );
  };

  const sendManualText = () => {
    const value = state.manualMessage.trim();
    if (!value) return;
    window.ApiShared.pubsub.publishText(state.manualSource, {
      type: TextEventType.final,
      value,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3 pt-2"
    >
      {/* Overview */}
      <div className="bg-base-200/50 p-2 rounded-lg">
        <p className="text-xs text-base-content/70 font-semibold mb-1">What it does:</p>
        <p className="text-[10px] text-base-content/60">
          Combines multiple text sources (speech, translation, text input, etc.) into a single unified chat stream. 
          All messages go through the same processing and formatting pipeline.
        </p>
      </div>

      {/* Source Selection */}
      <Section title="Input Sources" defaultOpen={true}>
        <p className="text-[10px] text-base-content/60 mb-2">
          Select which sources to combine. Messages from all selected sources will be unified:
        </p>
        <div className="space-y-2 bg-base-300/20 p-2 rounded">
          {sourceOptions.map((source) => (
            <InputCheckbox
              key={source.value}
              label={source.label}
              value={state.sources.includes(source.value)}
              onChange={(enabled) => toggleSource(source.value, enabled)}
            />
          ))}
        </div>
      </Section>

      {/* Message Format */}
      <Section title="Message Format" defaultOpen={true}>
        <InputText
          label="Format template"
          value={state.messageFormat}
          placeholder="{message}"
          onChange={(e) => up("messageFormat", e.target.value)}
        />
        <p className="text-[10px] text-base-content/60 mb-2">
          Available tokens:
        </p>
        <div className="text-[10px] text-base-content/60 space-y-1 ml-2 bg-base-200/30 p-2 rounded">
          <div><code className="bg-base-200 px-1 rounded">{"{message}"}</code> - The message text</div>
          <div><code className="bg-base-200 px-1 rounded">{"{source}"}</code> - Which input source (STT, Translation, etc.)</div>
          <div><code className="bg-base-200 px-1 rounded">{"{topic}"}</code> - Message topic if available</div>
          <div><code className="bg-base-200 px-1 rounded">{"{type}"}</code> - interim or final</div>
        </div>
      </Section>

      {/* Processing Options */}
      <Section title="Message Processing" defaultOpen={true}>
        <div className="space-y-3 bg-base-300/20 p-2 rounded">
          <div>
            <InputCheckbox
              label="Forward interim messages"
              value={state.includeInterim}
              onChange={(e) => up("includeInterim", e)}
            />
            <p className="text-[10px] text-base-content/60 ml-6">
              Include in-progress messages (while speaking), not just final ones
            </p>
          </div>
          <div>
            <InputCheckbox
              label="Trim whitespace"
              value={state.trim}
              onChange={(e) => up("trim", e)}
            />
            <p className="text-[10px] text-base-content/60 ml-6">
              Remove leading/trailing spaces from messages
            </p>
          </div>
          <div>
            <InputCheckbox
              label="Collapse whitespace"
              value={state.collapseWhitespace}
              onChange={(e) => up("collapseWhitespace", e)}
            />
            <p className="text-[10px] text-base-content/60 ml-6">
              Replace multiple spaces with single space
            </p>
          </div>
          <div>
            <InputCheckbox
              label="Ignore empty final messages"
              value={state.ignoreEmptyFinal}
              onChange={(e) => up("ignoreEmptyFinal", e)}
            />
            <p className="text-[10px] text-base-content/60 ml-6">
              Skip empty messages (useful to avoid blank captions)
            </p>
          </div>
        </div>
      </Section>

      {/* Manual Testing */}
      <Section title="Manual Test" defaultOpen={false}>
        <p className="text-[10px] text-base-content/60 mb-2">
          Send a test message to verify your unified chat setup:
        </p>
        <InputSelect
          label="Send as source"
          value={state.manualSource}
          options={manualSourceOptions}
          onValueChange={(value) => up("manualSource", value as TextEventSource)}
        />
        <InputText
          label="Message to send"
          value={state.manualMessage}
          placeholder="Type test message here..."
          onChange={(e) => up("manualMessage", e.target.value)}
        />
        <button
          className="btn btn-sm btn-primary w-full"
          onClick={sendManualText}
          disabled={!state.manualMessage.trim()}
        >
          Send test message
        </button>
      </Section>

      {/* Tips */}
      <div className="bg-base-200/30 p-2 rounded text-[10px] text-base-content/60">
        <p className="font-semibold mb-1">💡 Pro tips:</p>
        <p>• Use "{"{message}"}" in the format template for simplest setup</p>
        <p>• Enable "Ignore empty" if using interim messages to avoid blanks</p>
        <p>• Test with manual messages first to verify format looks correct</p>
      </div>
    </motion.div>
  );
};

const ChatSourceFilterPluginSettings: FC = () => {
  const state = useSnapshot(window.ApiServer.state.plugins.chatSourceFilter);
  const up = <K extends keyof ChatSourceFilterSettingsState>(
    key: K,
    value: ChatSourceFilterSettingsState[K]
  ) => {
    window.ApiServer.state.plugins.chatSourceFilter[key] = value;
  };

  const toggleSource = (source: TextEventSource, enabled: boolean) => {
    const sources = Array.from(state.sources) as TextEventSource[];
    up(
      "sources",
      enabled
        ? Array.from(new Set([...sources, source]))
        : sources.filter((value) => value !== source)
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3 pt-2"
    >
      {/* Overview */}
      <div className="bg-base-200/50 p-2 rounded-lg">
        <p className="text-xs text-base-content/70 font-semibold mb-1">What it does:</p>
        <p className="text-[10px] text-base-content/60">
          Filter the chat logs view to show messages only from selected sources. 
          Useful when you want to focus on specific types of messages.
        </p>
      </div>

      {/* Main Toggle */}
      <div className="space-y-2">
        <InputCheckbox
          label="Enable source filtering"
          value={state.enabled}
          onChange={(enabled) => up("enabled", enabled)}
        />
        <p className="text-[10px] text-base-content/60 ml-6">
          When enabled, chat logs show only messages from the selected sources
        </p>
      </div>

      {/* Source Options */}
      <Section title="Visible Sources" defaultOpen={true}>
        <div className={classNames("space-y-2 bg-base-300/20 p-2 rounded", !state.enabled && "opacity-50 pointer-events-none")}>
          {logSourceOptions.map((source) => (
            <InputCheckbox
              key={source.value}
              label={source.label}
              value={state.sources.includes(source.value)}
              onChange={(enabled) => toggleSource(source.value, enabled)}
            />
          ))}
        </div>
      </Section>

      {/* Info */}
      <div className="bg-base-200/30 p-2 rounded text-[10px] text-base-content/60">
        <p className="font-semibold mb-1">ℹ️ Where it applies:</p>
        <p>• Full chat logs view</p>
        <p>• Collapsible chat sidebar overlay</p>
      </div>
    </motion.div>
  );
};

const Inspector_Plugins: FC = () => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<PluginItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const updatePlugins = () => {
    const pluginManager = window.ApiServer?.getPluginManager();

    if (!pluginManager) {
      setLoading(false);
      return;
    }

    try {
      const pluginsList: PluginItemUI[] = pluginManager.getPluginStatuses();
      setPlugins(pluginsList);
      setLoading(false);
    } catch (error) {
      console.error("Error updating plugins:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    updatePlugins();

    // Poll for updates
    const interval = setInterval(updatePlugins, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const loadedCount = plugins.filter((p) => p.loaded).length;
  const totalCount = plugins.length;
  const openPluginsFolder = async () => {
    const documents = await documentDir();
    await open(await join(documents, "Curses", "plugins"));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col bg-base-100"
    >
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-base-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">{t("plugins.title", "Plugins")}</h2>
          <button
            className="btn btn-xs btn-ghost"
            title="Refresh plugins"
            onClick={() => {
              setLoading(true);
              updatePlugins();
            }}
          >
            <MdRefresh className="text-sm" />
          </button>
        </div>
        <div className="text-xs text-base-content/60">
          {loading ? (
            "Loading..."
          ) : totalCount === 0 ? (
            "No plugins available"
          ) : (
            <>
              {loadedCount}/{totalCount} loaded
            </>
          )}
        </div>
      </div>

      {/* Plugin List */}
      <SimpleBar className="flex-1 min-h-0 overflow-hidden">
        <div className="space-y-2 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="loading loading-spinner loading-sm"></div>
            </div>
          ) : plugins.length === 0 ? (
            <div className="text-sm text-base-content/50 py-8 text-center">
              No plugins found. Configure plugins in Documents/Curses/plugins/plugins.config.json
            </div>
          ) : (
            plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="bg-base-200/50 rounded-lg border border-base-300/50 overflow-hidden"
              >
                <button
                  onClick={() => toggleExpanded(plugin.id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-base-300/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {plugin.error ? (
                        <MdError
                          className="text-error text-lg"
                          title="Error"
                        />
                      ) : plugin.loaded ? (
                        <MdCheckCircle
                          className="text-success text-lg"
                          title="Loaded"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-base-content/30" />
                      )}
                    </div>

                    {/* Plugin info */}
                    <div className="min-w-0 text-left">
                      <div className="font-semibold text-sm text-base-content truncate">
                        {plugin.name}
                      </div>
                      <div className="text-xs text-base-content/60">
                        v{plugin.version}
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex-shrink-0 ml-2">
                    <span
                      className={classNames(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        plugin.error
                          ? "bg-error/20 text-error"
                          : plugin.loaded
                          ? "bg-success/20 text-success"
                          : "bg-base-300 text-base-content/60"
                      )}
                    >
                      {plugin.error ? "Error" : plugin.loaded ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {expanded.has(plugin.id) && (
                  <div className="border-t border-base-300/50 bg-base-300/30 max-h-96 overflow-y-auto">
                    <div className="px-3 pb-3 pt-3 space-y-2">
                      {plugin.description && (
                        <div>
                          <p className="text-xs text-base-content/70">
                            {plugin.description}
                          </p>
                        </div>
                      )}

                      {plugin.id === "current-song" && plugin.loaded && (
                        <NowPlayingSettings />
                      )}

                      {plugin.id === "uniform-chat-source" && plugin.loaded && (
                        <UniformChatSourcePluginSettings />
                      )}

                      {plugin.id === "chat-source-filter" && plugin.loaded && (
                        <ChatSourceFilterPluginSettings />
                      )}

                      {plugin.error && (
                        <div className="text-xs text-error bg-error/10 p-2 rounded border border-error/20">
                          <div className="font-semibold mb-1">Error Details:</div>
                          <div className="font-mono text-[10px] break-words overflow-auto max-h-20">
                            {plugin.error}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-base-content/50 pt-2">
                        <span>ID: {plugin.id}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SimpleBar>

      {/* Footer info */}
      <div className="flex-none px-4 py-3 border-t border-base-200 text-xs text-base-content/50 space-y-1">
        <p>
          Plugins are loaded from <code className="bg-base-200 px-1 rounded text-[10px]">Documents/Curses/plugins/plugins.config.json</code>
        </p>
        <p>
          Built-in plugins stay available unless disabled in that config.
        </p>
        <p>
          App and plugin settings are mirrored to <code className="bg-base-200 px-1 rounded text-[10px]">Documents/Curses/settings.json</code>.
        </p>
        <button
          className="btn btn-xs btn-ghost mt-1"
          onClick={openPluginsFolder}
        >
          Open plugins folder
        </button>
        <p>
          See <code className="bg-base-200 px-1 rounded text-[10px]">PLUGIN_DEVELOPMENT_GUIDE.md</code> for
          more info.
        </p>
      </div>
    </motion.div>
  );
};

export default Inspector_Plugins;
