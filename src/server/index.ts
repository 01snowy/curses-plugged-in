import Service_Sound from "@/server/services/sound";
import { InspectorTabPath } from "@/types";
import { proxy } from "valtio";
import { BackendState } from "./schema";
import Service_Discord from "./services/discord";
import Service_Keyboard from "./services/keyboard";
import Service_OBS from "./services/obs";
import Service_State from "./services/state";
import Service_STT from "./services/stt";
import Service_Translation from "./services/translation";
import Service_TTS from "./services/tts";
import Service_Twitch from "./services/twitch";
import Service_VRC from "./services/vrc";
import Service_NowPlaying from "./services/nowPlaying";
import { changeLanguage, initI18n } from '@/i18n';
import { PluginManager } from "./plugins";
import pluginsConfig from "../../plugins.config.json";
import { PluginConfig, PluginsConfigFileSchema } from "./plugins/types";
import {
  BaseDirectory,
  createDir,
  exists,
  readBinaryFile,
  writeBinaryFile,
} from "@tauri-apps/api/fs";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { documentDir, join } from "@tauri-apps/api/path";

export enum Services {
  vrc = "vrc",
  stt = "stt",
  tts = "tts",
  translation = "translation",
  twitch = "twitch",
  discord = "discord",
}

class ApiServer {
  constructor() {}

  private readonly _state = new Service_State();
  public readonly stt = new Service_STT();
  public readonly tts = new Service_TTS();
  public readonly translation = new Service_Translation();
  public readonly twitch = new Service_Twitch();
  public readonly discord = new Service_Discord();
  public readonly vrc = new Service_VRC();
  public readonly nowPlaying = new Service_NowPlaying();
  public readonly obs = new Service_OBS();
  public readonly keyboard = new Service_Keyboard();
  public readonly sound = new Service_Sound();
  private pluginManager: PluginManager | null = null;

  get state() {
    return this._state.state;
  }

  ui = proxy<{
    sidebarState: {
      tab: InspectorTabPath | undefined;
      show: boolean;
      expand: boolean;
    };
  }>({
    sidebarState: {
      tab: undefined,
      show: false,
      expand: false
    },
  });
  closeSidebar() {
    const sidebar = window.ApiServer.ui.sidebarState;
    sidebar.tab = undefined;
    sidebar.show = false;
  }
  changeTab(v?: InspectorTabPath) {
    const sidebar = window.ApiServer.ui.sidebarState;
    if (sidebar.tab?.tab === v?.tab && sidebar.tab?.value === v?.value && sidebar.show) {
      sidebar.show = false; // close tab
      sidebar.tab = undefined;
      return;
    }
    sidebar.tab = v; // close tab
    sidebar.show = true; // close tab
  }

  patchService<Key extends keyof BackendState["services"]>(
    service: Key,
    fn: (state: BackendState["services"][Key]) => void
  ) {
    fn(this.state.services[service]);
    // this.state.services[service] = produce(this.state.services[service], fn);
  }

  public changeTheme(value: string) {
    this.state.clientTheme = value;
    document.body.setAttribute("data-theme", value);
  }

  public changeScale(value: number) {
    this.state.uiScale = value;
    document.documentElement.style.setProperty("--uiscale", value.toString());
  }
  public changeLanguage(value: string) {
    this.state.uiLanguage = value;
    changeLanguage(value);
  }

  public getPluginManager(): PluginManager | null {
    return this.pluginManager;
  }

  private createPluginManager() {
    return new PluginManager({
      stt: this.stt,
      tts: this.tts,
      discord: this.discord,
      twitch: this.twitch,
      vrc: this.vrc,
      obs: this.obs,
    });
  }

  private async ensureUserPluginFolder() {
    const rootExists = await exists("Curses", { dir: BaseDirectory.Document });
    if (!rootExists) {
      await createDir("Curses", {
        dir: BaseDirectory.Document,
        recursive: true,
      });
    }

    const pluginsExists = await exists("Curses/plugins", {
      dir: BaseDirectory.Document,
    });
    if (!pluginsExists) {
      await createDir("Curses/plugins", {
        dir: BaseDirectory.Document,
        recursive: true,
      });
    }
  }

  private async readUserPluginsConfig() {
    await this.ensureUserPluginFolder();
    const configPath = "Curses/plugins/plugins.config.json";
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (!(await exists(configPath, { dir: BaseDirectory.Document }))) {
      await writeBinaryFile(
        configPath,
        encoder.encode(JSON.stringify(pluginsConfig, null, 2)),
        { append: false, dir: BaseDirectory.Document }
      );
      return pluginsConfig;
    }

    const data = await readBinaryFile(configPath, {
      dir: BaseDirectory.Document,
    });
    return JSON.parse(decoder.decode(data));
  }

  private mergePluginConfigs(rawUserConfig: unknown) {
    const bundledConfig = PluginsConfigFileSchema.parse(pluginsConfig);
    const userConfig = PluginsConfigFileSchema.safeParse(rawUserConfig);
    const pluginMap = new Map<string, PluginConfig>();

    for (const plugin of bundledConfig.plugins) {
      pluginMap.set(plugin.id, plugin);
    }

    if (userConfig.success) {
      for (const plugin of userConfig.data.plugins) {
        pluginMap.set(plugin.id, plugin);
      }
    } else {
      console.warn("User plugin config is invalid; loading bundled plugins only");
    }

    return {
      plugins: Array.from(pluginMap.values()),
    };
  }

  private async resolveUserPluginPaths(configs: PluginConfig[]) {
    const documents = await documentDir();
    const pluginsFolder = await join(documents, "Curses", "plugins");

    return Promise.all(
      configs.map(async (plugin) => {
        if (plugin.type !== "external" || !plugin.path) {
          return plugin;
        }

        if (
          plugin.path.startsWith("http://") ||
          plugin.path.startsWith("https://") ||
          plugin.path.startsWith("asset://") ||
          plugin.path.startsWith("file://")
        ) {
          return plugin;
        }

        const absolutePath = await join(pluginsFolder, plugin.path);
        return {
          ...plugin,
          path: convertFileSrc(absolutePath),
        };
      })
    );
  }

  public async initializePlugins(): Promise<void> {
    this.pluginManager = this.createPluginManager();

    try {
      const rawConfig = window.Config.isApp()
        ? await this.readUserPluginsConfig()
        : pluginsConfig;
      const config = this.mergePluginConfigs(rawConfig);
      for (const p of config.plugins) {
        if (p.id === "current-song" && p.config.spotify) {
          const s = p.config.spotify as Record<string, string>;
          s.clientId ||= import.meta.env.CURSES_SPOTIFY_CLIENT_ID ?? "";
          s.clientSecret ||= import.meta.env.CURSES_SPOTIFY_CLIENT_SECRET ?? "";
          s.refreshToken ||= import.meta.env.CURSES_SPOTIFY_REFRESH_TOKEN ?? "";
        }
      }

      // Load plugins from config
      await this.pluginManager.loadPlugins(
        window.Config.isApp()
          ? await this.resolveUserPluginPaths(config.plugins)
          : config.plugins.filter((plugin) => plugin.type === "builtin")
      );
    } catch (error) {
      console.warn("Failed to initialize plugins:", error);
      const bundledConfig = PluginsConfigFileSchema.parse(pluginsConfig);
      await this.pluginManager.loadPlugins(
        bundledConfig.plugins.filter((plugin) => plugin.type === "builtin")
      );
    }
  }

  public async init() {
    if (window.Config.isClient())
      return;
    await this._state.init();
    await window.ApiShared.peer.startServer();
    await this.twitch.init();
    await this.discord.init();
    await this.stt.init();
    await this.tts.init();
    await this.translation.init();
    await this.vrc.init();
    await this.nowPlaying.init();
    await this.obs.init();
    await this.keyboard.init();
    await initI18n(this.state.uiLanguage);
    await this.initializePlugins();
    this.changeTheme(this.state.clientTheme);
    this.changeScale(this.state.uiScale);
  }
}

export default ApiServer;
