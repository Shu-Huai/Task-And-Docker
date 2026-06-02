import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const ConfigSchema = z.object({
  server: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535)
  }),
  auth: z.object({
    password: z.string().min(1)
  }),
  tasks: z.object({
    folder: z.string().min(1)
  }),
  docker: z.object({
    enabled: z.boolean()
  })
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function normalizeTaskFolder(folder: string): string {
  const trimmed = folder.trim().replaceAll("/", "\\");
  const withLeading = trimmed.startsWith("\\") ? trimmed : `\\${trimmed}`;
  return withLeading.endsWith("\\") ? withLeading : `${withLeading}\\`;
}

export function loadConfig(path = resolve("config", "app.config.json")): AppConfig {
  const parsed = ConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return {
    ...parsed,
    tasks: {
      folder: normalizeTaskFolder(parsed.tasks.folder)
    }
  };
}
