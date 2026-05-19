import { zSafe } from "@/utils";
import { z } from "zod";

export const Service_NowPlaying_Schema = z
  .object({
    enable: zSafe(z.coerce.boolean(), true),
    displayFormat: zSafe(
      z.string(),
      "🎵 Now Playing: {artist} - {title}"
    ),
    updateInterval: zSafe(z.coerce.number(), 3000),
    sendToVrc: zSafe(z.coerce.boolean(), true),
    sendToCaptions: zSafe(z.coerce.boolean(), true),
    hideDelayMs: zSafe(z.coerce.number(), 5000),
    spotify: z.object({
      clientId: zSafe(z.string(), ""),
      clientSecret: zSafe(z.string(), ""),
      refreshToken: zSafe(z.string(), ""),
    }).default({}),
  })
  .default({});

export type NowPlaying_State = z.infer<typeof Service_NowPlaying_Schema>;
