import { IPlugin, PluginContext } from "../types";
import { z } from "zod";

export default class CurrentSongPlugin implements IPlugin {
  id = "current-song";
  name = "Current Song";
  version = "1.0.0";
  description = "Now playing for VRChat chatbox and captions";

  private context: PluginContext | null = null;

  getConfigSchema() {
    return z.object({
      spotify: z
        .object({
          clientId: z.string().optional(),
          clientSecret: z.string().optional(),
          refreshToken: z.string().optional(),
        })
        .optional(),
      updateInterval: z.number().min(1000).default(8000),
    });
  }

  async onInit(context: PluginContext): Promise<void> {
    this.context = context;
    const cfg = context.config as {
      spotify?: Record<string, string>;
      updateInterval?: number;
    };
    window.ApiServer.nowPlaying.configure({
      spotify: cfg.spotify,
      updateInterval: window.ApiServer.state.services.nowPlaying.data.updateInterval,
    });
    window.ApiServer.nowPlaying.start();
    this.context.log("Current Song plugin initialized");
  }

  async onDestroy(): Promise<void> {
    window.ApiServer.nowPlaying.stop();
    this.context?.log("Current Song plugin destroyed");
  }
}
