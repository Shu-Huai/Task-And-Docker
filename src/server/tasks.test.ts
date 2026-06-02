import { describe, expect, it, vi } from "vitest";
import { disableTask, listTasks, parseScheduledTaskJson, runTask, stopTask } from "./tasks";

describe("parseScheduledTaskJson", () => {
  it("maps PowerShell task JSON into task rows", () => {
    const json = JSON.stringify([
      {
        Name: "Acme",
        State: "Ready",
        LastRunTime: "/Date(1780406778000)/",
        LastTaskResult: 0
      },
      {
        Name: "Blog",
        State: "Running",
        LastRunTime: null,
        LastTaskResult: 267009
      }
    ]);

    expect(parseScheduledTaskJson(json)).toEqual([
      {
        name: "Acme",
        state: "Ready",
        lastRunTime: "2026-06-02T13:26:18.000Z",
        lastTaskResult: 0
      },
      {
        name: "Blog",
        state: "Running",
        lastRunTime: null,
        lastTaskResult: 267009
      }
    ]);
  });
});

describe("Task actions", () => {
  it("lists tasks with the configured folder", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    await listTasks("\\Auto-Start-A\\", run);

    expect(run.mock.calls[0][1].join(" ")).toContain("Get-ScheduledTask -TaskPath '\\Auto-Start-A\\'");
  });

  it("runs only tasks returned by the current list", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '[{"Name":"Acme","State":"Ready","LastRunTime":null,"LastTaskResult":0}]', stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await runTask("\\Auto-Start-A\\", "Acme", run);

    expect(run.mock.calls[1][1].join(" ")).toContain("Start-ScheduledTask");
    expect(run.mock.calls[1][1].join(" ")).toContain("-TaskName 'Acme'");
  });

  it("rejects stop for unknown tasks", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    await expect(stopTask("\\Auto-Start-A\\", "Missing", run)).rejects.toThrow("Task not found");
  });

  it("can disable a known task", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '[{"Name":"Acme","State":"Ready","LastRunTime":null,"LastTaskResult":0}]', stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await disableTask("\\Auto-Start-A\\", "Acme", run);

    expect(run.mock.calls[1][1].join(" ")).toContain("Disable-ScheduledTask");
  });
});
