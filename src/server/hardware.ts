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
  sensorReadings?: Array<{
    hardwareName: string;
    name: string;
    type: string;
    value: number | null;
  }>;
  gpuCounters?: Array<{
    luid: string;
    usagePercent: number | null;
    totalCommittedBytes: number | null;
    dedicatedUsageBytes: number | null;
    sharedUsageBytes: number | null;
  }>;
};

const HARDWARE_SCRIPT = String.raw`
function NumberOrNull($value) {
  if ($null -eq $value) { return $null }
  try { return [double]$value } catch { return $null }
}

function NormalizeName($value) {
  if ($null -eq $value) { return "" }
  return ("$value".ToLowerInvariant() -replace "[^a-z0-9]", "")
}

function ParseLinkSpeedBits($value) {
  if ($null -eq $value) { return $null }
  $text = "$value".Trim()
  if ($text -match "^([\d\.]+)\s*([kmgt]?)(?:b|bps)$") {
    $number = [double]$matches[1]
    switch ($matches[2].ToLowerInvariant()) {
      "k" { return $number * 1000 }
      "m" { return $number * 1000000 }
      "g" { return $number * 1000000000 }
      "t" { return $number * 1000000000000 }
      default { return $number }
    }
  }
  return NumberOrNull $value
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

function FindBundledLibreHardwareMonitor {
  $paths = @(
    (Join-Path (Get-Location) "tools\LibreHardwareMonitor"),
    "C:\Program Files\LibreHardwareMonitor",
    "C:\Program Files (x86)\LibreHardwareMonitor"
  )
  foreach ($path in $paths) {
    if (-not (Test-Path $path)) { continue }
    $exe = Get-ChildItem -Path $path -Recurse -Filter "LibreHardwareMonitor.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $exe) { return $exe.FullName }
  }
  return $null
}

function StartSensorProviderIfPresent {
  $process = Get-Process -Name LibreHardwareMonitor -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $process) { return }
  $exe = FindBundledLibreHardwareMonitor
  if ($null -eq $exe) { return }
  try {
    Start-Process -FilePath $exe -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 4
  } catch {}
}

StartSensorProviderIfPresent

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
$memoryUsed = [math]::Max([double]0, [double]($memoryTotal - $memoryFree))

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
    $used = [math]::Max([double]0, [double]($size - $free))
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
$gpuEngineUsage = $null
$gpuEngineByLuid = @{}
try {
  $gpuEngineSamples = @(Get-CimInstance -Namespace root\cimv2 -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue)
  if ($gpuEngineSamples.Count -gt 0) {
    $gpuEngineUsage = [math]::Min(100, ($gpuEngineSamples | Measure-Object -Property UtilizationPercentage -Sum).Sum)
    $gpuEngineSamples | ForEach-Object {
      if ($_.Name -match "luid_(0x[0-9a-fA-F]+_0x[0-9a-fA-F]+)") {
        $luid = $matches[1]
        if (-not $gpuEngineByLuid.ContainsKey($luid)) { $gpuEngineByLuid[$luid] = 0 }
        $gpuEngineByLuid[$luid] += [double]$_.UtilizationPercentage
      }
    }
  }
} catch {}

$gpuAdapterMemoryRows = @()
try {
  $gpuAdapterMemoryRows = @(Get-CimInstance -Namespace root\cimv2 -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -ErrorAction SilentlyContinue)
} catch {}
$sharedGpuUsage = if ($gpuAdapterMemoryRows.Count -gt 0) { ($gpuAdapterMemoryRows | Measure-Object -Property TotalCommitted -Sum).Sum } else { $null }
$gpuCounters = @($gpuAdapterMemoryRows | ForEach-Object {
  $luid = ""
  if ($_.Name -match "luid_(0x[0-9a-fA-F]+_0x[0-9a-fA-F]+)") { $luid = $matches[1] }
  [pscustomobject]@{
    luid = $luid
    usagePercent = if ($gpuEngineByLuid.ContainsKey($luid)) { [math]::Min(100, [double]$gpuEngineByLuid[$luid]) } else { $null }
    totalCommittedBytes = NumberOrNull $_.TotalCommitted
    dedicatedUsageBytes = NumberOrNull $_.DedicatedUsage
    sharedUsageBytes = NumberOrNull $_.SharedUsage
  }
})

$gpus = @()
foreach ($controller in $gpuControllers) {
  $vendor = GpuVendor $controller.Name
  if ("$($controller.Name)".ToLowerInvariant() -match "virtual|remote|mirror|basic render|display adapter") { continue }
  $nvidia = $null
  if ($vendor -eq "nvidia") {
    $nvidia = $nvidiaRows | Where-Object { $_.name -eq $controller.Name -or $controller.Name.Contains($_.name) -or $_.name.Contains($controller.Name) } | Select-Object -First 1
    if ($null -eq $nvidia -and $nvidiaRows.Count -eq 1) { $nvidia = $nvidiaRows[0] }
  }
  $gpuMemoryTotal = if ($null -ne $nvidia) { $nvidia.memoryTotalBytes } elseif ($controller.AdapterRAM) { [double]$controller.AdapterRAM } else { $null }
  $gpuMemoryUsed = if ($null -ne $nvidia) { $nvidia.memoryUsedBytes } elseif ($null -ne $sharedGpuUsage -and $gpuControllers.Count -eq 1) { [double]$sharedGpuUsage } else { $null }
  $gpus += [pscustomobject]@{
    name = "$($controller.Name)"
    vendor = $vendor
    usagePercent = if ($null -ne $nvidia) { $nvidia.usagePercent } elseif ($null -ne $gpuEngineUsage -and $gpuControllers.Count -eq 1) { NumberOrNull $gpuEngineUsage } else { $null }
    memoryTotalBytes = $gpuMemoryTotal
    memoryUsedBytes = $gpuMemoryUsed
    temperatureCelsius = if ($null -ne $nvidia) { $nvidia.temperatureCelsius } else { $null }
    powerWatts = if ($null -ne $nvidia) { $nvidia.powerWatts } else { $null }
  }
}

$adapterSpeeds = @{}
Get-CimInstance Win32_NetworkAdapter -Filter "NetEnabled=true" -ErrorAction SilentlyContinue |
  ForEach-Object {
    $speed = NumberOrNull $_.Speed
    $adapterSpeeds[(NormalizeName $_.Name)] = $speed
    if ($_.NetConnectionID) { $adapterSpeeds[(NormalizeName $_.NetConnectionID)] = $speed }
  }

try {
  Get-NetAdapter -ErrorAction SilentlyContinue |
    ForEach-Object {
      $speed = ParseLinkSpeedBits $_.LinkSpeed
      if ($null -eq $speed -or $speed -le 0) { return }
      $adapterSpeeds[(NormalizeName $_.Name)] = $speed
      if ($_.InterfaceDescription) { $adapterSpeeds[(NormalizeName $_.InterfaceDescription)] = $speed }
    }
} catch {}

$sensorReadings = @()
foreach ($namespace in @("root\LibreHardwareMonitor", "root\OpenHardwareMonitor")) {
  try {
    $sensorReadings += @(Get-CimInstance -Namespace $namespace -ClassName Sensor -ErrorAction SilentlyContinue | ForEach-Object {
      [pscustomobject]@{
        hardwareName = "$($_.Parent)"
        name = "$($_.Name)"
        type = "$($_.SensorType)"
        value = NumberOrNull $_.Value
      }
    })
  } catch {}
}

$networks = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    [pscustomobject]@{
      name = $_.Name
      speedBitsPerSecond = if ($adapterSpeeds.ContainsKey((NormalizeName $_.Name))) { $adapterSpeeds[(NormalizeName $_.Name)] } else { $null }
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
  sensorReadings = @($sensorReadings)
  gpuCounters = @($gpuCounters)
} | ConvertTo-Json -Depth 8
`;

export function parseHardwareSnapshotJson(stdout: string): HardwareSnapshot {
  return normalizeHardwareSnapshot(JSON.parse(stdout) as HardwareSnapshot);
}

export function normalizeHardwareSnapshot(snapshot: HardwareSnapshot): HardwareSnapshot {
  const sensorReadings = snapshot.sensorReadings ?? [];
  const cpuTemperature = snapshot.cpu.temperatureCelsius ?? sensorReadings
    .filter((sensor) => sensor.value !== null && /temperature/i.test(sensor.type) && /cpu|core|package/i.test(`${sensor.hardwareName} ${sensor.name}`))
    .reduce<number | null>((max, sensor) => Math.max(max ?? Number.NEGATIVE_INFINITY, sensor.value ?? Number.NEGATIVE_INFINITY), null);
  const cpuPower = snapshot.cpu.powerWatts ?? sensorReadings
    .filter((sensor) => sensor.value !== null && /power/i.test(sensor.type) && /cpu|package|processor/i.test(`${sensor.hardwareName} ${sensor.name}`))
    .reduce<number | null>((max, sensor) => Math.max(max ?? Number.NEGATIVE_INFINITY, sensor.value ?? Number.NEGATIVE_INFINITY), null);
  const integratedGpuCounterPool = (snapshot.gpuCounters ?? [])
    .filter((counter) => (counter.dedicatedUsageBytes ?? 0) < 268_435_456)
    .sort((left, right) => (right.totalCommittedBytes ?? 0) - (left.totalCommittedBytes ?? 0));

  return {
    ...snapshot,
    cpu: {
      ...snapshot.cpu,
      temperatureCelsius: cpuTemperature === Number.NEGATIVE_INFINITY ? null : cpuTemperature,
      powerWatts: cpuPower === Number.NEGATIVE_INFINITY ? null : cpuPower
    },
    disks: snapshot.disks.map((disk) => {
      const repairedUsedBytes = disk.usedBytes === null;
      const usedBytes = disk.usedBytes ?? (disk.totalBytes > 0 ? Math.max(0, disk.totalBytes - disk.freeBytes) : null);
      return {
        ...disk,
        usedBytes,
        usagePercent: repairedUsedBytes || disk.usagePercent === null
          ? (usedBytes !== null && disk.totalBytes > 0 ? Math.round((usedBytes / disk.totalBytes) * 1000) / 10 : null)
          : disk.usagePercent
      };
    }),
    gpus: snapshot.gpus
      .filter((gpu) => !/virtual|remote|mirror|basic render|display adapter/i.test(gpu.name))
      .map((gpu) => {
        if (gpu.vendor === "nvidia" || (gpu.usagePercent !== null && gpu.memoryUsedBytes !== null)) return gpu;
        const counter = integratedGpuCounterPool.shift();
        const rawMemoryUsed = gpu.memoryUsedBytes ?? counter?.totalCommittedBytes ?? null;
        const memoryUsedBytes = rawMemoryUsed !== null && gpu.memoryTotalBytes !== null
          ? Math.min(rawMemoryUsed, gpu.memoryTotalBytes)
          : rawMemoryUsed;
        return {
          ...gpu,
          usagePercent: gpu.usagePercent ?? counter?.usagePercent ?? null,
          memoryUsedBytes
        };
      })
  };
}

export async function collectHardwareSnapshot(runner: CommandRunner = runCommand): Promise<HardwareSnapshot> {
  const result = await runPowerShell(HARDWARE_SCRIPT, runner);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "无法读取硬件资源");
  }
  return parseHardwareSnapshotJson(result.stdout);
}
