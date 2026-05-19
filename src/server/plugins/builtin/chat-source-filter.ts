import { TextEventSource } from "@/types";
import { IPlugin, PluginContext } from "../types";
import { subscribe } from "valtio";
import { z } from "zod";

const defaultSources = [
  TextEventSource.stt,
  TextEventSource.translation,
  TextEventSource.textfield,
  TextEventSource.chat,
  TextEventSource.nowPlaying,
];

export default class ChatSourceFilterPlugin implements IPlugin {
  id = "chat-source-filter";
  name = "Chat Source Filter";
  version = "1.0.0";
  description = "Filters the collapsible chat sidebar and chat logs by text source";

  private context: PluginContext | null = null;
  private unsubscribeSettings?: () => void;

  getConfigSchema() {
    return z.object({
      enabled: z.boolean().default(false),
      sources: z.array(z.nativeEnum(TextEventSource)).default(defaultSources),
    });
  }

  async onInit(context: PluginContext): Promise<void> {
    this.context = context;

    this.unsubscribeSettings = subscribe(
      window.ApiServer.state.plugins.chatSourceFilter,
      () => {
        const { enabled, sources } =
          window.ApiServer.state.plugins.chatSourceFilter;
        void this.context?.setState("enabled", enabled);
        void this.context?.setState("sources", sources);
      }
    );

    this.context.log("Chat source filter ready");
  }

  async onDestroy(): Promise<void> {
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = undefined;
    this.context?.log("Chat source filter destroyed");
  }
}
