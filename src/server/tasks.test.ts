import { describe, expect, it, vi } from "vitest";
import { disableTask, listTasks, parseScheduledTaskJson, runTask, stopTask } from "./tasks";

describe("任务计划程序输出解析", () => {
  it("把 PowerShell 任务 JSON 映射为任务行", () => {
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

describe("任务计划程序操作", () => {
  it("生成任务列表脚本时不在哈希表开头插入分号", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    await listTasks("\\Auto-Start-A\\", run);

    const encoded = run.mock.calls[0][1].at(-1) as string;
    const decoded = Buffer.from(encoded, "base64").toString("utf16le");
    expect(decoded).toContain("Get-ScheduledTask -TaskPath '\\Auto-Start-A\\'");
    expect(decoded).toContain("[pscustomobject]@{\n    Name = $_.TaskName");
  });

  it("只运行当前列表中存在的任务", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '[{"Name":"Acme","State":"Ready","LastRunTime":null,"LastTaskResult":0}]', stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await runTask("\\Auto-Start-A\\", "Acme", run);

    const encoded = run.mock.calls[1][1].at(-1) as string;
    const decoded = Buffer.from(encoded, "base64").toString("utf16le");
    expect(decoded).toContain("Start-ScheduledTask");
    expect(decoded).toContain("-TaskName 'Acme'");
  });

  it("拒绝结束未知任务", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    await expect(stopTask("\\Auto-Start-A\\", "Missing", run)).rejects.toThrow("未找到任务");
  });

  it("可以禁用已知任务", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '[{"Name":"Acme","State":"Ready","LastRunTime":null,"LastTaskResult":0}]', stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await disableTask("\\Auto-Start-A\\", "Acme", run);

    const encoded = run.mock.calls[1][1].at(-1) as string;
    const decoded = Buffer.from(encoded, "base64").toString("utf16le");
    expect(decoded).toContain("Disable-ScheduledTask");
  });
});
