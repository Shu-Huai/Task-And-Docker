import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("loads app configuration from a JSON file", () => {
    const dir = mkdtempSync(join(tmpdir(), "task-docker-config-"));
    const path = join(dir, "app.config.json");
    writeFileSync(
      path,
      JSON.stringify({
        server: { host: "::", port: 8080 },
        auth: { password: "secret" },
        tasks: { folder: "\\Auto-Start-A" },
        docker: { enabled: true }
      })
    );

    const config = loadConfig(path);

    expect(config.server.port).toBe(8080);
    expect(config.auth.password).toBe("secret");
    expect(config.tasks.folder).toBe("\\Auto-Start-A\\");
    expect(config.docker.enabled).toBe(true);
  });

  it("normalizes task folders to leading and trailing backslashes", () => {
    const dir = mkdtempSync(join(tmpdir(), "task-docker-config-"));
    const path = join(dir, "app.config.json");
    writeFileSync(
      path,
      JSON.stringify({
        server: { host: "127.0.0.1", port: 3000 },
        auth: { password: "secret" },
        tasks: { folder: "Auto-Start-A" },
        docker: { enabled: false }
      })
    );

    expect(loadConfig(path).tasks.folder).toBe("\\Auto-Start-A\\");
  });
});
