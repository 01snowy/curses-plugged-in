import { IServiceInterface } from "@/types";
import { BaseDirectory, createDir, exists, readBinaryFile, writeBinaryFile } from "@tauri-apps/api/fs";
import debounce from "lodash/debounce";
import { proxy, snapshot, subscribe } from "valtio";
import { BackendState, BackendSchema } from "../../schema";

class Service_State implements IServiceInterface {
  state!: BackendState;
  private readonly appDataSettingsPath = "user/settings";
  private readonly appDataUserDir = "user";
  private readonly documentsSettingsPath = "Curses/settings.json";
  private readonly documentsUserDir = "Curses";
  private readonly webStorageKey = "curses.server.settings";

  async init() {
    let data = await this.#load_state();
    const hasData = !!data;
    // create new state
    if (!hasData) {
      data = {};
    }
    
    this.state = proxy(BackendSchema.parse(data));
    !hasData && this.#save_state();
    subscribe(this.state, () => this.#save_state());
    window.addEventListener("beforeunload", () => this.#save_state.flush());
  }

  private tryParseState(str: string | null) {
    if (str) try {
      const parse = JSON.parse(str);
      if (typeof parse !== "object") return;
      return parse;
    } catch (error) {
      console.error("invalid state data");
    }
  }

  async #load_state(): Promise<Record<string, any> | undefined> {
    if (!window.Config.isApp()) {
      return this.tryParseState(localStorage.getItem(this.webStorageKey));
    }
    await this.#ensure_documents_dir();
    const documentsState = await this.#read_state_file(
      this.documentsSettingsPath,
      BaseDirectory.Document
    );
    if (documentsState) {
      return documentsState;
    }

    const appDataState = await this.#read_state_file(
      this.appDataSettingsPath,
      BaseDirectory.AppData
    );
    if (appDataState) {
      return appDataState;
    }
  }

  async #read_state_file(path: string, dir: BaseDirectory) {
    const decoder = new TextDecoder();
    const fileExists = await exists(path, { dir });
    if (!fileExists)
      return;
    try {
      const data = await readBinaryFile(path, { dir });
      return this.tryParseState(decoder.decode(data));
    } catch (error) {
      return;
    }
  }

  async #ensure_documents_dir() {
    const bExists = await exists(this.documentsUserDir, {
      dir: BaseDirectory.Document,
    });
    if (!bExists) {
      await createDir(this.documentsUserDir, {
        dir: BaseDirectory.Document,
        recursive: true,
      });
    }
  }

  #save_state = debounce(async () => {
    if (!window.Config.isApp()) {
      localStorage.setItem(this.webStorageKey, JSON.stringify(snapshot(this.state)));
      return;
    }
    const encoder = new TextEncoder();
    const bExists = await exists(this.appDataUserDir, { dir: BaseDirectory.AppData });
    if (!bExists)
      await createDir(this.appDataUserDir, { dir: BaseDirectory.AppData, recursive: true });
    await this.#ensure_documents_dir();
    const value = JSON.stringify(snapshot(this.state));
    await writeBinaryFile(this.appDataSettingsPath, encoder.encode(value), {append: false, dir: BaseDirectory.AppData});
    await writeBinaryFile(this.documentsSettingsPath, encoder.encode(value), {append: false, dir: BaseDirectory.Document});
  }, 1000);
}
export default Service_State;
