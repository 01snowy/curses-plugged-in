import { FC, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MdCheckCircle, MdError, MdRefresh } from "react-icons/md";
import SimpleBar from "simplebar-react";
import classNames from "classnames";
import { useSnapshot } from "valtio";
import { InputCheckbox, InputSelect, InputText } from "./components/input";
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
      className="space-y-2 pt-2"
    >
      <InputCheckbox
        label="Enable now playing"
        value={state.enable}
        onChange={(e) => {
          up("enable", e);
          e ? window.ApiServer.nowPlaying.start() : window.ApiServer.nowPlaying.stop();
        }}
      />
      <InputText
        label="Message ({artist}, {title}, {album})"
        value={state.displayFormat}
        onChange={(e) => up("displayFormat", e.target.value)}
      />
      <InputText
        type="number"
        label="Poll interval (ms)"
        min={1000}
        value={String(state.updateInterval)}
        onChange={(e) => {
          up("updateInterval", parseInt(e.target.value, 10) || 3000);
          window.ApiServer.nowPlaying.start();
        }}
      />
      <InputText
        type="number"
        label="Show again after speech (ms)"
        min={500}
        value={String(state.hideDelayMs)}
        onChange={(e) => up("hideDelayMs", parseInt(e.target.value, 10) || 5000)}
      />
      <InputCheckbox
        label="Send to VRChat chatbox (OSC final)"
        value={state.sendToVrc}
        onChange={(e) => up("sendToVrc", e)}
      />
      <InputCheckbox
        label="Send to OBS captions"
        value={state.sendToCaptions}
        onChange={(e) => up("sendToCaptions", e)}
      />
      <InputText
        label="Spotify client ID"
        value={state.spotify.clientId}
        onChange={(e) =>
          up("spotify", { ...state.spotify, clientId: e.target.value })
        }
      />
      <InputText
        label="Spotify client secret"
        type="password"
        value={state.spotify.clientSecret}
        onChange={(e) =>
          up("spotify", { ...state.spotify, clientSecret: e.target.value })
        }
      />
      <InputText
        label="Spotify refresh token"
        type="password"
        value={state.spotify.refreshToken}
        onChange={(e) =>
          up("spotify", { ...state.spotify, refreshToken: e.target.value })
        }
      />
      <p className="text-[10px] text-base-content/50">
        Hidden during STT and chat. Use a text element with source &quot;Now playing&quot;, animation off.
      </p>
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
      className="space-y-2 pt-2"
    >
      <InputText
        label="Message format"
        value={state.messageFormat}
        onChange={(e) => up("messageFormat", e.target.value)}
      />
      <p className="text-[10px] text-base-content/50">
        Tokens: {"{message}"}, {"{source}"}, {"{topic}"}, {"{type}"}
      </p>
      {sourceOptions.map((source) => (
        <InputCheckbox
          key={source.value}
          label={source.label}
          value={state.sources.includes(source.value)}
          onChange={(enabled) => toggleSource(source.value, enabled)}
        />
      ))}
      <InputCheckbox
        label="Forward interim messages"
        value={state.includeInterim}
        onChange={(e) => up("includeInterim", e)}
      />
      <InputCheckbox
        label="Trim message"
        value={state.trim}
        onChange={(e) => up("trim", e)}
      />
      <InputCheckbox
        label="Collapse whitespace"
        value={state.collapseWhitespace}
        onChange={(e) => up("collapseWhitespace", e)}
      />
      <InputCheckbox
        label="Ignore empty final messages"
        value={state.ignoreEmptyFinal}
        onChange={(e) => up("ignoreEmptyFinal", e)}
      />
      <div className="pt-2 space-y-2">
        <InputSelect
          label="Send as source"
          value={state.manualSource}
          options={manualSourceOptions}
          onValueChange={(value) => up("manualSource", value as TextEventSource)}
        />
        <InputText
          label="Text to send"
          value={state.manualMessage}
          onChange={(e) => up("manualMessage", e.target.value)}
        />
        <button
          className="btn btn-sm btn-primary w-full"
          onClick={sendManualText}
        >
          Send text
        </button>
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
      className="space-y-2 pt-2"
    >
      <InputCheckbox
        label="Filter chat logs by source"
        value={state.enabled}
        onChange={(enabled) => up("enabled", enabled)}
      />
      <div className={classNames("space-y-2", !state.enabled && "opacity-50")}>
        {logSourceOptions.map((source) => (
          <InputCheckbox
            key={source.value}
            label={source.label}
            value={state.sources.includes(source.value)}
            onChange={(enabled) => toggleSource(source.value, enabled)}
          />
        ))}
      </div>
      <p className="text-[10px] text-base-content/50">
        Applies to the full chat logs view and the collapsible overlay chat sidebar.
      </p>
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
                  <div className="px-3 pb-3 border-t border-base-300/50 space-y-2 bg-base-300/30">
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
