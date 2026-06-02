import type { CommandRunner } from "./command";
import { runPowerShell } from "./command";
import { normalizeTaskFolder } from "./config";

export type ScheduledTask = {
  name: string;
  state: string;
  lastRunTime: string | null;
  lastTaskResult: number | null;
};

type PowerShellTask = {
  Name?: string;
  State?: string | number;
  LastRunTime?: string | null;
  LastTaskResult?: number | null;
};

function parsePowerShellDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = /\/Date\((\d+)\)\//.exec(value);
  if (match) {
    return new Date(Number(match[1])).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replaceAll("'", "''");
}

export function parseScheduledTaskJson(stdout: string): ScheduledTask[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  const raw = JSON.parse(trimmed) as PowerShellTask | PowerShellTask[];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item) => ({
    name: item.Name ?? "",
    state: String(item.State ?? ""),
    lastRunTime: parsePowerShellDate(item.LastRunTime),
    lastTaskResult: item.LastTaskResult ?? null
  }));
}

export async function listTasks(folder: string, runner?: CommandRunner): Promise<ScheduledTask[]> {
  const taskPath = normalizeTaskFolder(folder);
  const script = [
    "$ProgressPreference = 'SilentlyContinue'",
    `Get-ScheduledTask -TaskPath '${escapePowerShellSingleQuoted(taskPath)}' | ForEach-Object {`,
    "  $info = Get-ScheduledTaskInfo -TaskName $_.TaskName -TaskPath $_.TaskPath",
    "  [pscustomobject]@{",
    "    Name = $_.TaskName",
    "    State = $_.State.ToString()",
    "    LastRunTime = if ($info.LastRunTime) { $info.LastRunTime.ToString('o') } else { $null }",
    "    LastTaskResult = $info.LastTaskResult",
    "  }",
    "} | ConvertTo-Json -Depth 3 -Compress"
  ].join("; ");
  const result = await runPowerShell(script, runner);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to list scheduled tasks");
  }
  return parseScheduledTaskJson(result.stdout);
}

async function assertTaskExists(folder: string, taskName: string, runner?: CommandRunner): Promise<void> {
  const tasks = await listTasks(folder, runner);
  if (!tasks.some((task) => task.name === taskName)) {
    throw new Error("Task not found");
  }
}

async function runTaskCommand(
  folder: string,
  taskName: string,
  command: "Start-ScheduledTask" | "Stop-ScheduledTask" | "Disable-ScheduledTask",
  runner?: CommandRunner
): Promise<void> {
  await assertTaskExists(folder, taskName, runner);
  const taskPath = normalizeTaskFolder(folder);
  const script = `${command} -TaskPath '${escapePowerShellSingleQuoted(taskPath)}' -TaskName '${escapePowerShellSingleQuoted(taskName)}'`;
  const result = await runPowerShell(script, runner);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Unable to run ${command}`);
  }
}

export function runTask(folder: string, taskName: string, runner?: CommandRunner): Promise<void> {
  return runTaskCommand(folder, taskName, "Start-ScheduledTask", runner);
}

export function stopTask(folder: string, taskName: string, runner?: CommandRunner): Promise<void> {
  return runTaskCommand(folder, taskName, "Stop-ScheduledTask", runner);
}

export function disableTask(folder: string, taskName: string, runner?: CommandRunner): Promise<void> {
  return runTaskCommand(folder, taskName, "Disable-ScheduledTask", runner);
}
