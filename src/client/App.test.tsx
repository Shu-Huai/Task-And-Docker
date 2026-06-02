import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("App", () => {
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

  it("renders login when the session is unauthenticated", async () => {
    render(<App />);

    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("logs in and shows task rows", async () => {
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

    await userEvent.type(await screen.findByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Task Scheduler" })).toBeInTheDocument();
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run task Acme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End task Acme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable task Acme" })).toBeInTheDocument();
  });

  it("switches to Docker page and renders container actions", async () => {
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
    expect(screen.getByRole("button", { name: "Start container db" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop container db" })).toBeInTheDocument();
  });

  it("confirms destructive actions", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "End task Acme" }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
  });
});
