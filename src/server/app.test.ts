import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import type { AppConfig } from "./config";

const config: AppConfig = {
  server: { host: "127.0.0.1", port: 3000 },
  auth: { password: "secret" },
  tasks: { folder: "\\Auto-Start-A\\" },
  docker: { enabled: true }
};

function makeApp() {
  return createApp({
    config,
    services: {
      listTasks: vi.fn().mockResolvedValue([{ name: "Acme", state: "Ready", lastRunTime: null, lastTaskResult: 0 }]),
      runTask: vi.fn().mockResolvedValue(undefined),
      stopTask: vi.fn().mockResolvedValue(undefined),
      disableTask: vi.fn().mockResolvedValue(undefined),
      listContainers: vi.fn().mockResolvedValue([{ id: "abc123", name: "db", image: "postgres", ports: "5432/tcp", lastStarted: "1 day ago", state: "running", status: "Up 1 day" }]),
      startContainer: vi.fn().mockResolvedValue(undefined),
      stopContainer: vi.fn().mockResolvedValue(undefined)
    }
  });
}

describe("createApp", () => {
  it("protects resource APIs before login", async () => {
    const { app } = makeApp();

    const response = await request(app).get("/api/tasks");

    expect(response.status).toBe(401);
  });

  it("logs in with the configured password and returns current session", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);

    const login = await agent.post("/api/auth/login").send({ password: "secret" });
    const me = await agent.get("/api/me");

    expect(login.status).toBe(200);
    expect(me.body).toEqual({ authenticated: true });
  });

  it("rejects an incorrect password", async () => {
    const { app } = makeApp();

    const response = await request(app).post("/api/auth/login").send({ password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid password");
  });

  it("lists tasks using the configured task folder", async () => {
    const { app, services } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    const response = await agent.get("/api/tasks");

    expect(response.status).toBe(200);
    expect(response.body.items[0].name).toBe("Acme");
    expect(services.listTasks).toHaveBeenCalledWith("\\Auto-Start-A\\");
  });

  it("runs, stops, and disables tasks", async () => {
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

  it("lists and controls Docker containers", async () => {
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

  it("logs out", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ password: "secret" });

    await agent.post("/api/auth/logout");
    const me = await agent.get("/api/me");

    expect(me.body).toEqual({ authenticated: false });
  });
});
