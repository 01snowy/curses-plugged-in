import { TextEvent, TextEventSource, TextEventType } from "@/types";
import { IPlugin, PluginContext } from "../types";
import { subscribe } from "valtio";
import { z } from "zod";

const sourceSchema = z.nativeEnum(TextEventSource);
const defaultSources = [
  TextEventSource.stt,
  TextEventSource.translation,
  TextEventSource.textfield,
  TextEventSource.nowPlaying,
];

type UniformChatConfig = {
  sources: TextEventSource[];
  messageFormat: string;
  includeInterim: boolean;
  collapseWhitespace: boolean;
  trim: boolean;
  ignoreEmptyFinal: boolean;
};

export default class UniformChatSourcePlugin implements IPlugin {
  id = "uniform-chat-source";
  name = "Uniform Chat Source";
  version = "1.0.0";
  description = "Combines text sources into one normalized chat text source";

  private context: PluginContext | null = null;
  private subscriptions: string[] = [];
  private unsubscribeSettings?: () => void;
  private nowPlayingTimer?: ReturnType<typeof setInterval>;
  private sourcesKey = "";
  private lastPublished = new Map<
    TextEventSource,
    { value: string; type: TextEventType }
  >();
  private config: UniformChatConfig = {
    sources: defaultSources,
    messageFormat: "{message}",
    includeInterim: true,
    collapseWhitespace: true,
    trim: true,
    ignoreEmptyFinal: true,
  };

  getConfigSchema() {
    return z.object({
      sources: z.array(sourceSchema).default(defaultSources),
      messageFormat: z.string().default("{message}"),
      includeInterim: z.boolean().default(true),
      collapseWhitespace: z.boolean().default(true),
      trim: z.boolean().default(true),
      ignoreEmptyFinal: z.boolean().default(true),
    });
  }

  async onInit(context: PluginContext): Promise<void> {
    this.context = context;
    this.config = this.readSettings(context.config as Partial<UniformChatConfig>);
    window.ApiShared.pubsub.registerEvent({
      label: "Unified chat",
      value: TextEventSource.chat,
    });

    this.subscribeToSources();
    this.unsubscribeSettings = subscribe(
      window.ApiServer.state.plugins.uniformChatSource,
      () => {
        const nextConfig = this.readSettings(this.config);
        const nextSourcesKey = this.getSourcesKey(nextConfig.sources);
        this.lastPublished.clear();
        this.config = nextConfig;
        if (nextSourcesKey !== this.sourcesKey) {
          this.subscribeToSources();
        } else {
          this.syncNowPlayingPolling();
        }
      }
    );

    this.context.log(
      `Listening to ${this.config.sources.length} sources as ${TextEventSource.chat}`
    );
  }

  async onDestroy(): Promise<void> {
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = undefined;
    this.unsubscribeSources();
    this.stopNowPlayingPolling();
    this.context?.log("Uniform chat source destroyed");
  }

  private readSettings(fallback: Partial<UniformChatConfig>): UniformChatConfig {
    const settings = window.ApiServer.state.plugins.uniformChatSource;
    return {
      sources: settings.sources.length ? settings.sources : fallback.sources ?? defaultSources,
      messageFormat: settings.messageFormat || fallback.messageFormat || "{message}",
      includeInterim: settings.includeInterim ?? fallback.includeInterim ?? true,
      collapseWhitespace:
        settings.collapseWhitespace ?? fallback.collapseWhitespace ?? true,
      trim: settings.trim ?? fallback.trim ?? true,
      ignoreEmptyFinal:
        settings.ignoreEmptyFinal ?? fallback.ignoreEmptyFinal ?? true,
    };
  }

  private subscribeToSources() {
    this.unsubscribeSources();
    const sources = this.inputSources();
    this.sourcesKey = this.getSourcesKey(sources);
    for (const source of sources) {
      const token = window.ApiShared.pubsub.subscribeText(
        source,
        (event, eventName) => this.handleTextEvent(source, event, eventName),
        true
      );
      this.subscriptions.push(token);
    }
    this.syncNowPlayingPolling();
  }

  private unsubscribeSources() {
    for (const token of this.subscriptions) {
      window.ApiShared.pubsub.unsubscribe(token);
    }
    this.subscriptions = [];
  }

  private inputSources(): TextEventSource[] {
    return Array.from(
      new Set(
        this.config.sources.filter(
          (source) =>
            source !== TextEventSource.any && source !== TextEventSource.chat
        )
      )
    );
  }

  private getSourcesKey(sources: TextEventSource[]) {
    return [...sources].sort().join("|");
  }

  private syncNowPlayingPolling() {
    if (this.inputSources().includes(TextEventSource.nowPlaying)) {
      this.startNowPlayingPolling();
    } else {
      this.stopNowPlayingPolling();
    }
  }

  private startNowPlayingPolling() {
    if (this.nowPlayingTimer) return;
    const poll = () => void window.ApiServer.nowPlaying.publishCurrentToTextSource();
    const interval = Math.max(
      1000,
      window.ApiServer.state.services.nowPlaying.data.updateInterval
    );
    poll();
    this.nowPlayingTimer = setInterval(poll, interval);
  }

  private stopNowPlayingPolling() {
    if (this.nowPlayingTimer) clearInterval(this.nowPlayingTimer);
    this.nowPlayingTimer = undefined;
  }

  private handleTextEvent(
    source: TextEventSource,
    event?: TextEvent,
    eventName?: string
  ) {
    if (!event) return;
    if (!this.config.includeInterim && event.type === TextEventType.interim) {
      return;
    }

    const value = this.normalizeValue(event.value);
    if (
      this.config.ignoreEmptyFinal &&
      event.type === TextEventType.final &&
      !value
    ) {
      return;
    }
    if (this.isDuplicate(source, value, event.type)) {
      return;
    }
    const content = this.formatMessage(value, event, source, eventName);

    window.ApiShared.pubsub.publishText(TextEventSource.chat, {
      type: event.type,
      value: content,
      emotes: event.emotes ?? {},
      textFieldType: event.textFieldType,
    });

    void this.context?.setState("last-source", eventName ?? source);
  }

  private isDuplicate(
    source: TextEventSource,
    value: string,
    type: TextEventType
  ) {
    if (source !== TextEventSource.nowPlaying) return false;
    const previous = this.lastPublished.get(source);
    this.lastPublished.set(source, { value, type });
    return previous?.value === value && previous.type === type;
  }

  private normalizeValue(value: string) {
    let normalized = value ?? "";
    if (this.config.collapseWhitespace) {
      normalized = normalized.replace(/\s+/g, " ");
    }
    if (this.config.trim) {
      normalized = normalized.trim();
    }
    return normalized;
  }

  private formatMessage(
    message: string,
    event: TextEvent,
    source: TextEventSource,
    eventName?: string
  ) {
    const type = event.type === TextEventType.final ? "final" : "interim";
    const label = this.sourceLabel(source, eventName);
    return this.config.messageFormat
      .replaceAll("{message}", message)
      .replaceAll("{source}", label)
      .replaceAll("{topic}", eventName ?? source)
      .replaceAll("{type}", type);
  }

  private sourceLabel(source: TextEventSource, eventName?: string) {
    if (eventName === TextEventSource.textfield && eventName !== source) {
      return eventName.replace("text.", "");
    }
    if (source === TextEventSource.stt) return "stt";
    if (source === TextEventSource.translation) return "translation";
    if (source === TextEventSource.textfield) return "text field";
    if (source === TextEventSource.nowPlaying) return "now playing";
    return source.replace("text.", "");
  }
}
