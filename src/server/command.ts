import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });
};

export async function runPowerShell(script: string, runner: CommandRunner = runCommand): Promise<CommandResult> {
  const fullScript = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [System.Text.Encoding]::UTF8",
    "$ProgressPreference = 'SilentlyContinue'",
    script
  ].join("\n");
  const encodedScript = Buffer.from(fullScript, "utf16le").toString("base64");
  if (encodedScript.length > 30000) {
    const folder = await mkdtemp(join(tmpdir(), "task-and-docker-"));
    const scriptPath = join(folder, "script.ps1");
    try {
      await writeFile(scriptPath, fullScript, "utf8");
      return await runner("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath
      ]);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
  return runner("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    encodedScript
  ]);
}
