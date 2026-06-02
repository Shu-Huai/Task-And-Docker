import { describe, expect, it, vi } from "vitest";
import { runPowerShell } from "./command";

describe("runPowerShell", () => {
  it("使用 EncodedCommand 执行 PowerShell，避免脚本被 shell 二次解析", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await runPowerShell("Write-Output '你好'", run);

    expect(run.mock.calls[0][0]).toBe("powershell.exe");
    expect(run.mock.calls[0][1]).toContain("-EncodedCommand");
    expect(run.mock.calls[0][1].join(" ")).not.toContain("Write-Output");
  });
});
