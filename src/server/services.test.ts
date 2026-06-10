import { describe, expect, it, vi } from "vitest";
import { listManagedServiceProcesses, parseServiceProcessJson, stopManagedServiceProcess } from "./services";

describe("服务进程输出解析", () => {
  it("按被管理端口保留离线端口并映射监听进程", () => {
    const json = JSON.stringify([
      {
        port: 8080,
        pid: 1844,
        name: "python",
        status: "Running",
        cpuPercent: 3.4,
        memoryBytes: 268435456,
        diskReadBytesPerSecond: 1024,
        diskWriteBytesPerSecond: 2048,
        networkReceiveBytesPerSecond: null,
        networkTransmitBytesPerSecond: null
      }
    ]);

    expect(parseServiceProcessJson(json, [8080, 3306])).toEqual([
      {
        port: 3306,
        pid: null,
        name: null,
        status: "not-listening",
        cpuPercent: null,
        memoryBytes: null,
        diskReadBytesPerSecond: null,
        diskWriteBytesPerSecond: null,
        networkReceiveBytesPerSecond: null,
        networkTransmitBytesPerSecond: null
      },
      {
        port: 8080,
        pid: 1844,
        name: "python",
        status: "listening",
        cpuPercent: 3.4,
        memoryBytes: 268435456,
        diskReadBytesPerSecond: 1024,
        diskWriteBytesPerSecond: 2048,
        networkReceiveBytesPerSecond: null,
        networkTransmitBytesPerSecond: null
      }
    ]);
  });
});

describe("服务进程操作", () => {
  it("通过 PowerShell 按端口读取监听进程", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    await listManagedServiceProcesses([8080, 6379], run);

    const encoded = run.mock.calls[0][1].at(-1) as string;
    const decoded = Buffer.from(encoded, "base64").toString("utf16le");
    expect(decoded).toContain("$managedPorts = @(6379,8080)");
    expect(decoded).toContain("Get-NetTCPConnection");
    expect(decoded).toContain("Win32_PerfFormattedData_PerfProc_Process");
  });

  it("停止前重新确认端口当前监听的 PID", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ port: 8080, pid: 1844, name: "python", status: "Running" }]),
        stderr: "",
        exitCode: 0
      })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await stopManagedServiceProcess(8080, [8080], run);

    const encoded = run.mock.calls[1][1].at(-1) as string;
    const decoded = Buffer.from(encoded, "base64").toString("utf16le");
    expect(decoded).toContain("Stop-Process");
    expect(decoded).toContain("-Id 1844");
  });

  it("拒绝停止未被管理或未监听的端口", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    await expect(stopManagedServiceProcess(3000, [8080], run)).rejects.toThrow("端口未纳入管理");
    await expect(stopManagedServiceProcess(8080, [8080], run)).rejects.toThrow("端口当前没有监听进程");
  });
});
