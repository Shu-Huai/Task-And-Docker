import request from "supertest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import type { AppConfig } from "./config";

const config: AppConfig = {
  server: { host: "127.0.0.1", port: 3000 },
  auth: { password: "secret" },
  tasks: { folder: "\\Auto-Start-A\\" },
  docker: { enabled: true },
  services: { managedPorts: [8080] }
};

function makeApp(configPath?: string) {
  return createApp({
    config,
    configPath,
    services: {
      listTasks: vi.fn().mockResolvedValue([{ name: "Acme", state: "Ready", lastRunTime: null, lastTaskResult: 0 }]),
      runTask: vi.fn().mockResolvedValue(undefined),
      stopTask: vi.fn().mockResolvedValue(undefined),
      disableTask: vi.fn().mockResolvedValue(undefined),
      listContainers: vi.fn().mockResolvedValue([{ id: "abc123", name: "db", image: "postgres", ports: "5432/tcp", lastStarted: "1 day ago", state: "running", status: "Up 1 day", composeProject: "searxng", composeService: "db" }]),
      startContainer: vi.fn().mockResolvedValue(undefined),
      stopContainer: vi.fn().mockResolvedValue(undefined),
      startComposeProject: vi.fn().mockResolvedValue(undefined),
      stopComposeProject: vi.fn().mockResolvedValue(undefined),
      listManagedServiceProcesses: vi.fn().mockResolvedValue([
        {
          port: 8080,
          pid: 1844,
          name: "python",
          status: "listening",
          cpuPercent: 5,
          memoryBytes: 268435456,
          diskReadBytesPerSecond: 1024,
          diskWriteBytesPerSecond: 2048,
          networkReceiveBytesPerSecond: null,
          networkTransmitBytesPerSecond: null
        }
      ]),
      stopManagedServiceProcess: vi.fn().mockResolvedValue(undefined),
      collectHardwareSnapshot: vi.fn().mockResolvedValue({
        sampledAt: "2026-06-05T10:00:00.000Z",
        cpu: { name: "Intel Core i9", usagePercent: 30, powerWatts: null, temperatureCelsius: null, cores: [] },
        memory: { totalBytes: 100, usedBytes: 50, usagePercent: 50 },
        disks: [],
        gpus: [],
        networks: []
      })
    }
  });
}

describe("应用服务", () => {
  it("未登录时保护资源接口", async () => {
    const { app } = makeApp();

    const response = await request(app).get("/api/tasks");

    expect(response.status).toBe(401);
  });

  it("使用配置密码登录并返回当前会话", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);

    const login = await agent.post("/api/auth/login").send({ password: "secret" });
    const me = await agent.get("/api/me");

    expect(login.status).toBe(200);
    expect(me.body).toEqual({ authenticated: true });
  });

  it("拒绝错误密码", async () => {
    const { app } = makeApp();

    const response = await request(app).post("/api/auth/login").send({ password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("密码错误");
  });

  it("使用配置的任务文件夹列出任务", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    const response = await agent.get("/api/tasks");

    expect(response.status).toBe(200);
    expect(response.body.items[0].name).toBe("Acme");
    expect(services.listTasks).toHaveBeenCalledWith("\\Auto-Start-A\\");
  });

  it("运行、结束并禁用任务", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    await agent.post("/api/tasks/Acme/run");
    await agent.post("/api/tasks/Acme/stop");
    await agent.post("/api/tasks/Acme/disable");

    expect(services.runTask).toHaveBeenCalledWith("\\Auto-Start-A\\", "Acme");
    expect(services.stopTask).toHaveBeenCalledWith("\\Auto-Start-A\\", "Acme");
    expect(services.disableTask).toHaveBeenCalledWith("\\Auto-Start-A\\", "Acme");
  });

  it("列出并控制 Docker 容器", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    const list = await agent.get("/api/docker/containers");
    await agent.post("/api/docker/containers/abc123/start");
    await agent.post("/api/docker/containers/abc123/stop");

    expect(list.body.items[0].id).toBe("abc123");
    expect(services.startContainer).toHaveBeenCalledWith("abc123");
    expect(services.stopContainer).toHaveBeenCalledWith("abc123");
  });

  it("按 Compose 项目控制 Docker 容器", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    await agent.post("/api/docker/projects/searxng/start");
    await agent.post("/api/docker/projects/searxng/stop");

    expect(services.startComposeProject).toHaveBeenCalledWith("searxng");
    expect(services.stopComposeProject).toHaveBeenCalledWith("searxng");
  });

  it("读取硬件资源快照", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    const response = await agent.get("/api/hardware/snapshot");

    expect(response.status).toBe(200);
    expect(response.body.item.cpu.usagePercent).toBe(30);
    expect(services.collectHardwareSnapshot).toHaveBeenCalled();
  });

  it("列出并停止被管理端口上的服务进程", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    const list = await agent.get("/api/services/processes");
    await agent.post("/api/services/ports/8080/stop");

    expect(list.status).toBe(200);
    expect(list.body.items[0].pid).toBe(1844);
    expect(services.listManagedServiceProcesses).toHaveBeenCalledWith([8080]);
    expect(services.stopManagedServiceProcess).toHaveBeenCalledWith(8080, [8080]);
  });

  it("添加被管理服务端口并写入配置文件", async () => {
    const dir = mkdtempSync(join(tmpdir(), "task-docker-config-"));
    const configPath = join(dir, "app.config.json");
    writeFileSync(configPath, JSON.stringify(config));
    const { app, services } = makeApp(configPath);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    const response = await agent.post("/api/services/ports").send({ port: 3306 });

    expect(response.status).toBe(200);
    expect(response.body.ports).toEqual([3306, 8080]);
    expect(services.listManagedServiceProcesses).toHaveBeenCalledWith([3306, 8080]);
    expect(JSON.parse(readFileSync(configPath, "utf8")).services.managedPorts).toEqual([3306, 8080]);
  });

  it("退出登录", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    await agent.post("/api/auth/logout");
    const me = await agent.get("/api/me");

    expect(me.body).toEqual({ authenticated: false });
  });

  it("提供静态目录时托管构建后的前端", async () => {
    const staticDir = mkdtempSync(join(tmpdir(), "task-docker-static-"));
    writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>任务与 Docker</title>");
    const { app } = createApp({ config, staticDir });

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("任务与 Docker");
  });
});
