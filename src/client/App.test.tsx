import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("前端应用", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/me")) {
          return jsonResponse({ authenticated: false });
        }
        return jsonResponse({});
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未登录时显示登录表单", async () => {
    render(<App />);

    expect(await screen.findByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  it("登录后显示任务行", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/me")) return jsonResponse({ authenticated: false });
      if (url.endsWith("/api/auth/login")) return jsonResponse({ authenticated: true });
      if (url.endsWith("/api/tasks")) {
        return jsonResponse({
          items: [{ name: "Acme", state: "Ready", lastRunTime: null, lastTaskResult: 0 }]
        });
      }
      if (url.endsWith("/api/docker/containers")) {
        return jsonResponse({ items: [] });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await userEvent.type(await screen.findByLabelText("密码"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("heading", { level: 1, name: "任务计划程序" })).toBeInTheDocument();
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "运行任务 Acme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束任务 Acme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "禁用任务 Acme" })).toBeInTheDocument();
  });

  it("切换到 Docker 页面并显示容器操作", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/me")) return jsonResponse({ authenticated: true });
        if (url.endsWith("/api/tasks")) return jsonResponse({ items: [] });
        if (url.endsWith("/api/docker/containers")) {
          return jsonResponse({
            items: [{ id: "abc123", name: "db", image: "postgres", ports: "5432/tcp", lastStarted: "1 day ago", state: "exited", status: "Exited" }]
          });
        }
        return jsonResponse({});
      })
    );
    render(<App />);

    const dockerButtons = await screen.findAllByRole("button", { name: "Docker" });
    await userEvent.click(dockerButtons[0]);

    expect(await screen.findByText("postgres")).toBeInTheDocument();
    expect(screen.getByText("exited")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启动容器 db" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停止容器 db" })).toBeInTheDocument();
  });

  it("危险操作需要确认", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/me")) return jsonResponse({ authenticated: true });
        if (url.endsWith("/api/tasks")) {
          return jsonResponse({ items: [{ name: "Acme", state: "Running", lastRunTime: null, lastTaskResult: 267009 }] });
        }
        if (url.endsWith("/api/docker/containers")) return jsonResponse({ items: [] });
        return jsonResponse({});
      })
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "结束任务 Acme" }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
  });
});
