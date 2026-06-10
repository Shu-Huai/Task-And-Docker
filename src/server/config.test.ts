import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, saveManagedServicePorts } from "./config";

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
        docker: { enabled: true },
        services: { managedPorts: [8080, 3306] }
      })
    );

    const config = loadConfig(path);

    expect(config.server.port).toBe(8080);
    expect(config.auth.password).toBe("secret");
    expect(config.tasks.folder).toBe("\\Auto-Start-A\\");
    expect(config.docker.enabled).toBe(true);
    expect(config.services.managedPorts).toEqual([3306, 8080]);
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
    expect(loadConfig(path).services.managedPorts).toEqual([]);
  });

  it("保存被管理服务端口并去重排序", () => {
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

    saveManagedServicePorts(path, [8080, 3306, 8080]);

    const saved = JSON.parse(readFileSync(path, "utf8"));
    expect(saved.services.managedPorts).toEqual([3306, 8080]);
  });
});
