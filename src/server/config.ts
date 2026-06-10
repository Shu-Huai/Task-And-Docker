import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export const DEFAULT_CONFIG_PATH = resolve("config", "app.config.json");

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
  }),
  services: z.object({
    managedPorts: z.array(z.number().int().min(1).max(65535))
  }).default({ managedPorts: [] })
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function normalizeTaskFolder(folder: string): string {
  const trimmed = folder.trim().replaceAll("/", "\\");
  const withLeading = trimmed.startsWith("\\") ? trimmed : `\\${trimmed}`;
  return withLeading.endsWith("\\") ? withLeading : `${withLeading}\\`;
}

function normalizePorts(ports: number[]): number[] {
  return [...new Set(ports)]
    .filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535)
    .sort((left, right) => left - right);
}

export function loadConfig(path = DEFAULT_CONFIG_PATH): AppConfig {
  const parsed = ConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return {
    ...parsed,
    tasks: {
      folder: normalizeTaskFolder(parsed.tasks.folder)
    },
    services: {
      managedPorts: normalizePorts(parsed.services.managedPorts)
    }
  };
}

export function saveManagedServicePorts(path: string, ports: number[]): void {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.services = {
    ...(raw.services ?? {}),
    managedPorts: normalizePorts(ports)
  };
  writeFileSync(path, JSON.stringify(raw, null, 2) + "\n");
}
