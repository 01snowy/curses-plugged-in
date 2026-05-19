import { invoke } from "@tauri-apps/api/tauri";
import { IServiceInterface, TextEvent, TextEventSource, TextEventType } from "@/types";
import { NowPlaying_State } from "./schema";

type NowPlayingInfo = { title: string; artist: string; album: string };
type Track = {
  id?: string;
  name: string;
  artists?: { name: string }[];
  album?: { name: string };
};

type PluginSpotifyConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

class Service_NowPlaying implements IServiceInterface {
  private pollTimer?: ReturnType<typeof setInterval>;
  private restoreTimer?: ReturnType<typeof setTimeout>;
  private speechBusy = false;
  private suppressing = false;
  private lastTrackKey = "";
  private currentTrack: Track | null = null;
  private pluginSpotify: PluginSpotifyConfig = {};
  private tokenCache: { token?: string; expiry?: number; key?: string } = {};
  private subs: string[] = [];

  get #data(): NowPlaying_State {
    return window.ApiServer.state.services.nowPlaying.data;
  }

  configure(config: { spotify?: PluginSpotifyConfig; updateInterval?: number }) {
    if (config.spotify) this.pluginSpotify = config.spotify;
  }

  async init() {
    this.subs.push(
      window.ApiShared.pubsub.subscribeText(
        TextEventSource.stt,
        (e) => this.handleSpeech(e),
        true
      ),
      window.ApiShared.pubsub.subscribeText(
        TextEventSource.translation,
        (e) => this.handleSpeech(e),
        true
      ),
      window.ApiShared.pubsub.subscribeText(
        TextEventSource.textfield,
        (e) => this.handleSpeech(e),
        true
      )
    );
    window.ApiShared.pubsub.registerEvent({
      label: "Now playing",
      value: TextEventSource.nowPlaying,
    });
  }

  start() {
    this.stop();
    if (!this.#data.enable) return;
    const interval = Math.max(1000, this.#data.updateInterval);
    this.pollTimer = setInterval(() => void this.poll(), interval);
    void this.poll();
  }

  refresh() {
    void this.poll();
  }

  async publishCurrentToTextSource(forceClear = false) {
    try {
      if (!forceClear) {
        this.currentTrack = await this.fetchTrack();
      }
      this.sendToCaptions(
        forceClear || !this.#data.enable ? "" : this.formatMessage(this.currentTrack)
      );
    } catch (error) {
      console.error("[nowPlaying] publish to text source failed", error);
    }
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
    this.applyDisplay(true);
  }

  private handleSpeech(event?: TextEvent) {
    if (this.suppressing || !event) return;
    if (!event.value) {
      if (event.type === TextEventType.interim) this.scheduleRestore();
      return;
    }
    this.speechBusy = true;
    this.applyDisplay();
    if (event.type === TextEventType.final) this.scheduleRestore();
  }

  private scheduleRestore() {
    clearTimeout(this.restoreTimer);
    const delay = Math.max(500, this.#data.hideDelayMs);
    this.restoreTimer = setTimeout(() => {
      this.speechBusy = false;
      this.applyDisplay();
    }, delay);
  }

  private formatMessage(track: Track | null): string {
    if (!track) return "";
    return this.#data.displayFormat
      .replace("{artist}", track.artists?.[0]?.name || "Unknown")
      .replace("{title}", track.name)
      .replace("{album}", track.album?.name || "Unknown");
  }

  private applyDisplay(forceClear = false) {
    this.suppressing = true;
    const message =
      forceClear || this.speechBusy || !this.#data.enable
        ? ""
        : this.formatMessage(this.currentTrack);
    if (this.#data.sendToVrc) this.sendToVrc(message);
    if (this.#data.sendToCaptions) this.sendToCaptions(message);
    this.suppressing = false;
  }

  private sendToVrc(message: string) {
    const vrc = window.ApiServer.state.services.vrc.data;
    if (!vrc.enable) return;
    window.ApiServer.vrc.pushChatboxFinal(message);
  }

  private sendToCaptions(message: string) {
    window.ApiShared.pubsub.publishText(TextEventSource.nowPlaying, {
      type: TextEventType.final,
      value: message,
    });
  }

  private trackKey(track: Track) {
    const artist = track.artists?.[0]?.name ?? "";
    return track.id ?? `${artist}:${track.name}`;
  }

  private async poll() {
    if (!this.#data.enable) return;
    try {
      const track = await this.fetchTrack();
      this.currentTrack = track;
      if (!track) {
        this.lastTrackKey = "";
        this.applyDisplay();
        return;
      }
      this.lastTrackKey = this.trackKey(track);
      this.applyDisplay();
    } catch (error) {
      console.error("[nowPlaying] poll failed", error);
    }
  }

  private async fetchTrack(): Promise<Track | null> {
    if (this.hasSpotifyCreds()) return this.fetchSpotify();
    if (window.Config.isApp()) return this.fetchWindows();
    return null;
  }

  private hasSpotifyCreds() {
    const spotify = this.getSpotifyConfig();
    return !!(
      spotify.clientId &&
      spotify.clientSecret &&
      spotify.refreshToken
    );
  }

  private getSpotifyConfig(): PluginSpotifyConfig {
    const stateSpotify = this.#data.spotify;
    return {
      clientId: stateSpotify.clientId || this.pluginSpotify.clientId,
      clientSecret: stateSpotify.clientSecret || this.pluginSpotify.clientSecret,
      refreshToken: stateSpotify.refreshToken || this.pluginSpotify.refreshToken,
    };
  }

  private async fetchWindows(): Promise<Track | null> {
    const info = await invoke<NowPlayingInfo | null>("get_now_playing");
    if (!info?.title) return null;
    return {
      name: info.title,
      artists: [{ name: info.artist || "Unknown" }],
      album: { name: info.album || "" },
    };
  }

  private async fetchSpotify(): Promise<Track | null> {
    const token = await this.getAccessToken();
    if (!token) return null;
    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 204 || response.status === 401) return null;
    const data = await response.json();
    return data.item ?? null;
  }

  private async getAccessToken(): Promise<string | null> {
    const { clientId, clientSecret, refreshToken } = this.getSpotifyConfig();
    if (!clientId || !clientSecret || !refreshToken) return null;
    const cacheKey = `${clientId}:${refreshToken}`;
    if (
      this.tokenCache.token &&
      this.tokenCache.expiry &&
      this.tokenCache.key === cacheKey &&
      Date.now() < this.tokenCache.expiry
    ) {
      return this.tokenCache.token;
    }
    const auth = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!response.ok) return null;
    const data = await response.json();
    this.tokenCache = {
      token: data.access_token,
      expiry: Date.now() + data.expires_in * 1000,
      key: cacheKey,
    };
    return data.access_token;
  }
}

export default Service_NowPlaying;
