import { customAlphabet, urlAlphabet } from "nanoid";
import { Service_Discord_Schema } from "./services/discord/schema";
import { Service_OBS_Schema } from "./services/obs/schema";
import { Service_STT_Schema } from "./services/stt/schema";
import { Service_Translation_Schema } from "./services/translation/schema";
import { Service_TTS_Schema } from "./services/tts/schema";
import { Service_Twitch_Schema } from "./services/twitch/schema";
import { Service_VRC_Schema } from "./services/vrc/schema";
import { Service_NowPlaying_Schema } from "./services/nowPlaying/schema";

import { zSafe, zStringNumber } from "@/utils";
import { TextEventSource, zodTextEventSource } from "@/types";
import { z } from "zod";

const zodServiceSchemaFactory = <Data extends z.ZodDefault<z.AnyZodObject>>(schema: Data) => {
  return z.object({
    showActionButton: zSafe(z.coerce.boolean(), false),
    data: schema
  });
}

export const PluginSettingsSchema = z.object({
  uniformChatSource: z.object({
    sources: zSafe(z.array(zodTextEventSource), [
      TextEventSource.stt,
      TextEventSource.translation,
      TextEventSource.textfield,
      TextEventSource.nowPlaying,
    ]),
    messageFormat: zSafe(z.string(), "{message}"),
    includeInterim: zSafe(z.coerce.boolean(), true),
    collapseWhitespace: zSafe(z.coerce.boolean(), true),
    trim: zSafe(z.coerce.boolean(), true),
    ignoreEmptyFinal: zSafe(z.coerce.boolean(), true),
    manualSource: zSafe(zodTextEventSource, TextEventSource.textfield),
    manualMessage: zSafe(z.string(), ""),
  }).default({}),
  chatSourceFilter: z.object({
    enabled: zSafe(z.coerce.boolean(), false),
    sources: zSafe(z.array(zodTextEventSource), [
      TextEventSource.stt,
      TextEventSource.translation,
      TextEventSource.textfield,
      TextEventSource.chat,
      TextEventSource.nowPlaying,
    ]),
  }).default({}),
}).default({});

export const BackendSchema = z.object({
  id: zSafe(z.string(), () => customAlphabet(urlAlphabet, 42)()),
  linkAddress: zSafe(z.string(), ""),
  clientTheme: zSafe(z.string(), "curses"),
  uiScale: zSafe(z.number(), 1),
  uiLanguage: zSafe(z.string(), "en"),
  showOverlay: zSafe(z.coerce.boolean(), false),
  showLogs: zSafe(z.coerce.boolean(), false),
  muteSoundEffects: zSafe(z.coerce.boolean(), false),
  showOverlayLogs: zSafe(z.coerce.boolean(), false),
  backgroundInputTimer: zSafe(zStringNumber(), "5000"),
  shortcuts: z.object({
    bgInput: zSafe(z.string(), ""),
    start: zSafe(z.string(), ""),
    muteMic: zSafe(z.string(), ""),
    muteSound: zSafe(z.string(), ""),
  }).default({}),
  services: z.object({
    vrc: zodServiceSchemaFactory(Service_VRC_Schema).default({}),
    stt: zodServiceSchemaFactory(Service_STT_Schema).default({}),
    tts: zodServiceSchemaFactory(Service_TTS_Schema).default({}),
    translation: zodServiceSchemaFactory(Service_Translation_Schema).default({}),
    twitch: zodServiceSchemaFactory(Service_Twitch_Schema).default({}),
    discord: zodServiceSchemaFactory(Service_Discord_Schema).default({}),
    obs: zodServiceSchemaFactory(Service_OBS_Schema).default({}),
    nowPlaying: zodServiceSchemaFactory(Service_NowPlaying_Schema).default({}),
  }).default({}),
  plugins: PluginSettingsSchema,
}).default({});
export type BackendState = z.infer<typeof BackendSchema>;
export type UniformChatSourceSettings = BackendState["plugins"]["uniformChatSource"];
export type ChatSourceFilterSettings = BackendState["plugins"]["chatSourceFilter"];
