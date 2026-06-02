import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("配置加载", () => {
  it("从 JSON 文件读取应用配置", () => {
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

  it("把任务文件夹规范化为前后都有反斜杠", () => {
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
