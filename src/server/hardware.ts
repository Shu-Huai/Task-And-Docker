import type { CommandRunner } from "./command";
import { runCommand, runPowerShell } from "./command";

export type HardwareCoreMetric = {
  name: string;
  usagePercent: number | null;
};

export type HardwareSnapshot = {
  sampledAt: string;
  cpu: {
    name: string;
    usagePercent: number | null;
    powerWatts: number | null;
    temperatureCelsius: number | null;
    cores: HardwareCoreMetric[];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    usagePercent: number | null;
  };
  disks: Array<{
    name: string;
    label: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number | null;
    readBytesPerSecond: number | null;
    writeBytesPerSecond: number | null;
  }>;
  gpus: Array<{
    name: string;
    vendor: "intel" | "nvidia" | "amd" | "unknown";
    usagePercent: number | null;
    memoryTotalBytes: number | null;
    memoryUsedBytes: number | null;
    temperatureCelsius: number | null;
    powerWatts: number | null;
  }>;
  networks: Array<{
    name: string;
    speedBitsPerSecond: number | null;
    receiveBytesPerSecond: number | null;
    transmitBytesPerSecond: number | null;
  }>;
};

const HARDWARE_SCRIPT = String.raw`
function NumberOrNull($value) {
  if ($null -eq $value) { return $null }
  try { return [double]$value } catch { return $null }
}

function PercentOrNull($used, $total) {
  if ($null -eq $total -or [double]$total -le 0) { return $null }
  return [math]::Round(([double]$used / [double]$total) * 100, 1)
}

function GpuVendor($name) {
  $lower = "$name".ToLowerInvariant()
  if ($lower.Contains("nvidia")) { return "nvidia" }
  if ($lower.Contains("intel")) { return "intel" }
  if ($lower.Contains("amd") -or $lower.Contains("radeon")) { return "amd" }
  return "unknown"
}

$processor = Get-CimInstance Win32_Processor | Select-Object -First 1
$cpuTotal = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction SilentlyContinue
$coreCounters = Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "_Total" -and $_.Name -match "^\d+(,\d+)?$" } |
  Sort-Object Name |
  ForEach-Object {
    [pscustomobject]@{
      name = $_.Name
      usagePercent = NumberOrNull $_.PercentProcessorTime
    }
  }

$os = Get-CimInstance Win32_OperatingSystem
$memoryTotal = [double]$os.TotalVisibleMemorySize * 1024
$memoryFree = [double]$os.FreePhysicalMemory * 1024
$memoryUsed = [math]::Max(0, $memoryTotal - $memoryFree)

$diskPerf = @{}
Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "_Total" } |
  ForEach-Object { $diskPerf[$_.Name] = $_ }

$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Sort-Object DeviceID |
  ForEach-Object {
    $perf = $diskPerf[$_.DeviceID]
    $size = if ($null -ne $_.Size) { [double]$_.Size } else { 0 }
    $free = if ($null -ne $_.FreeSpace) { [double]$_.FreeSpace } else { 0 }
    $used = [math]::Max(0, $size - $free)
    [pscustomobject]@{
      name = $_.DeviceID
      label = "$($_.VolumeName)"
      totalBytes = $size
      freeBytes = $free
      usedBytes = $used
      usagePercent = PercentOrNull $used $size
      readBytesPerSecond = NumberOrNull $perf.DiskReadBytesPersec
      writeBytesPerSecond = NumberOrNull $perf.DiskWriteBytesPersec
    }
  }

$nvidiaRows = @()
try {
  $nvidiaOutput = & nvidia-smi --query-gpu=name,utilization.gpu,memory.total,memory.used,temperature.gpu,power.draw --format=csv,noheader,nounits 2>$null
  if ($LASTEXITCODE -eq 0 -and $nvidiaOutput) {
    $nvidiaRows = @($nvidiaOutput | ForEach-Object {
      $parts = $_.Split(",") | ForEach-Object { $_.Trim() }
      [pscustomobject]@{
        name = $parts[0]
        usagePercent = NumberOrNull $parts[1]
        memoryTotalBytes = (NumberOrNull $parts[2]) * 1048576
        memoryUsedBytes = (NumberOrNull $parts[3]) * 1048576
        temperatureCelsius = NumberOrNull $parts[4]
        powerWatts = NumberOrNull $parts[5]
      }
    })
  }
} catch {}

$gpuControllers = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
$gpus = @()
foreach ($controller in $gpuControllers) {
  $vendor = GpuVendor $controller.Name
  $nvidia = $null
  if ($vendor -eq "nvidia") {
    $nvidia = $nvidiaRows | Where-Object { $_.name -eq $controller.Name -or $controller.Name.Contains($_.name) -or $_.name.Contains($controller.Name) } | Select-Object -First 1
    if ($null -eq $nvidia -and $nvidiaRows.Count -eq 1) { $nvidia = $nvidiaRows[0] }
  }
  $memoryTotal = if ($null -ne $nvidia) { $nvidia.memoryTotalBytes } elseif ($controller.AdapterRAM) { [double]$controller.AdapterRAM } else { $null }
  $gpus += [pscustomobject]@{
    name = "$($controller.Name)"
    vendor = $vendor
    usagePercent = if ($null -ne $nvidia) { $nvidia.usagePercent } else { $null }
    memoryTotalBytes = $memoryTotal
    memoryUsedBytes = if ($null -ne $nvidia) { $nvidia.memoryUsedBytes } else { $null }
    temperatureCelsius = if ($null -ne $nvidia) { $nvidia.temperatureCelsius } else { $null }
    powerWatts = if ($null -ne $nvidia) { $nvidia.powerWatts } else { $null }
  }
}

$adapterSpeeds = @{}
Get-CimInstance Win32_NetworkAdapter -Filter "NetEnabled=true" -ErrorAction SilentlyContinue |
  ForEach-Object { $adapterSpeeds[$_.Name] = NumberOrNull $_.Speed }

$networks = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    [pscustomobject]@{
      name = $_.Name
      speedBitsPerSecond = if ($adapterSpeeds.ContainsKey($_.Name)) { $adapterSpeeds[$_.Name] } else { $null }
      receiveBytesPerSecond = NumberOrNull $_.BytesReceivedPersec
      transmitBytesPerSecond = NumberOrNull $_.BytesSentPersec
    }
  }

[pscustomobject]@{
  sampledAt = (Get-Date).ToUniversalTime().ToString("o")
  cpu = [pscustomobject]@{
    name = "$($processor.Name)"
    usagePercent = NumberOrNull $cpuTotal.PercentProcessorTime
    powerWatts = $null
    temperatureCelsius = $null
    cores = @($coreCounters)
  }
  memory = [pscustomobject]@{
    totalBytes = $memoryTotal
    usedBytes = $memoryUsed
    usagePercent = PercentOrNull $memoryUsed $memoryTotal
  }
  disks = @($disks)
  gpus = @($gpus)
  networks = @($networks)
} | ConvertTo-Json -Depth 8
`;

export function parseHardwareSnapshotJson(stdout: string): HardwareSnapshot {
  return JSON.parse(stdout) as HardwareSnapshot;
}

export async function collectHardwareSnapshot(runner: CommandRunner = runCommand): Promise<HardwareSnapshot> {
  const result = await runPowerShell(HARDWARE_SCRIPT, runner);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法读取硬件资源");
  }
  return parseHardwareSnapshotJson(result.stdout);
}
