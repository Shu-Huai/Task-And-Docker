import type { CommandRunner } from "./command";
import { runCommand, runPowerShell } from "./command";

export type ServiceProcessRow = {
  port: number;
  pid: number | null;
  name: string | null;
  status: "listening" | "not-listening";
  cpuPercent: number | null;
  memoryBytes: number | null;
  diskReadBytesPerSecond: number | null;
  diskWriteBytesPerSecond: number | null;
  networkReceiveBytesPerSecond: number | null;
  networkTransmitBytesPerSecond: number | null;
};

type RawServiceProcessRow = {
  port?: number;
  pid?: number | null;
  name?: string | null;
  status?: string | null;
  cpuPercent?: number | null;
  memoryBytes?: number | null;
  diskReadBytesPerSecond?: number | null;
  diskWriteBytesPerSecond?: number | null;
  networkReceiveBytesPerSecond?: number | null;
  networkTransmitBytesPerSecond?: number | null;
};

function normalizePorts(ports: number[]): number[] {
  return [...new Set(ports)]
    .filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535)
    .sort((left, right) => left - right);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function offlineRow(port: number): ServiceProcessRow {
  return {
    port,
    pid: null,
    name: null,
    status: "not-listening",
    cpuPercent: null,
    memoryBytes: null,
    diskReadBytesPerSecond: null,
    diskWriteBytesPerSecond: null,
    networkReceiveBytesPerSecond: null,
    networkTransmitBytesPerSecond: null
  };
}

export function parseServiceProcessJson(stdout: string, managedPorts: number[]): ServiceProcessRow[] {
  const parsed = stdout.trim() ? JSON.parse(stdout) as RawServiceProcessRow[] | RawServiceProcessRow : [];
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const byPort = new Map<number, ServiceProcessRow>();

  for (const row of rows) {
    const port = numberOrNull(row.port);
    const pid = numberOrNull(row.pid);
    if (port === null || pid === null) continue;
    byPort.set(port, {
      port,
      pid,
      name: row.name ?? null,
      status: "listening",
      cpuPercent: numberOrNull(row.cpuPercent),
      memoryBytes: numberOrNull(row.memoryBytes),
      diskReadBytesPerSecond: numberOrNull(row.diskReadBytesPerSecond),
      diskWriteBytesPerSecond: numberOrNull(row.diskWriteBytesPerSecond),
      networkReceiveBytesPerSecond: numberOrNull(row.networkReceiveBytesPerSecond),
      networkTransmitBytesPerSecond: numberOrNull(row.networkTransmitBytesPerSecond)
    });
  }

  return normalizePorts(managedPorts).map((port) => byPort.get(port) ?? offlineRow(port));
}

function buildListScript(ports: number[]): string {
  const portList = normalizePorts(ports).join(",");
  return String.raw`
$managedPorts = @(__PORTS__)

function NumberOrNull($value) {
  if ($null -eq $value) { return $null }
  try { return [double]$value } catch { return $null }
}

if ($managedPorts.Count -eq 0) {
  @() | ConvertTo-Json
  return
}

$perfByPid = @{}
try {
  Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction SilentlyContinue |
    Where-Object { $null -ne $_.IDProcess -and $_.IDProcess -gt 0 } |
    ForEach-Object { $perfByPid[[int]$_.IDProcess] = $_ }
} catch {}

$connections = @(Get-NetTCPConnection -LocalPort $managedPorts -State Listen -ErrorAction SilentlyContinue)
$rows = @()
foreach ($connection in $connections | Sort-Object LocalPort, OwningProcess -Unique) {
  $process = $null
  try { $process = Get-Process -Id $connection.OwningProcess -ErrorAction Stop } catch {}
  $perf = $perfByPid[[int]$connection.OwningProcess]
  $rows += [pscustomobject]@{
    port = [int]$connection.LocalPort
    pid = [int]$connection.OwningProcess
    name = if ($null -ne $process) { $process.ProcessName } else { $null }
    status = if ($null -ne $process) { "$($process.Responding)" } else { "Unknown" }
    cpuPercent = NumberOrNull $perf.PercentProcessorTime
    memoryBytes = if ($null -ne $process) { NumberOrNull $process.WorkingSet64 } else { $null }
    diskReadBytesPerSecond = NumberOrNull $perf.IOReadBytesPersec
    diskWriteBytesPerSecond = NumberOrNull $perf.IOWriteBytesPersec
    networkReceiveBytesPerSecond = $null
    networkTransmitBytesPerSecond = $null
  }
}

$rows | ConvertTo-Json -Depth 4
`.replace("__PORTS__", portList);
}

export async function listManagedServiceProcesses(ports: number[], runner: CommandRunner = runCommand): Promise<ServiceProcessRow[]> {
  const managedPorts = normalizePorts(ports);
  if (managedPorts.length === 0) return [];
  const result = await runPowerShell(buildListScript(managedPorts), runner);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法读取服务进程");
  }
  return parseServiceProcessJson(result.stdout, managedPorts);
}

export async function stopManagedServiceProcess(port: number, managedPorts: number[], runner: CommandRunner = runCommand): Promise<void> {
  if (!normalizePorts(managedPorts).includes(port)) {
    throw new Error("端口未纳入管理");
  }
  const row = (await listManagedServiceProcesses([port], runner))[0];
  if (!row?.pid) {
    throw new Error("端口当前没有监听进程");
  }
  const result = await runPowerShell(`Stop-Process -Id ${row.pid} -Force`, runner);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法停止服务进程");
  }
}
