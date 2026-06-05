param(
  [string]$Root = (Get-Location).Path,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "SilentlyContinue"

function NumberOrNull($value) {
  if ($null -eq $value) { return $null }
  try { return [double]$value } catch { return $null }
}

$sensorRoot = Join-Path $Root "tools\LibreHardwareMonitor"
$libraryPath = Join-Path $sensorRoot "LibreHardwareMonitorLib.dll"
if (-not (Test-Path $libraryPath)) {
  $json = "[]"
  if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { Set-Content -Path $OutputPath -Value $json -Encoding UTF8 }
  Write-Output $json
  exit 0
}

try {
  [System.Environment]::CurrentDirectory = $sensorRoot
  Add-Type -Path $libraryPath | Out-Null
  $computer = [LibreHardwareMonitor.Hardware.Computer]::new()
  $computer.IsCpuEnabled = $true
  $computer.IsGpuEnabled = $true
  $computer.IsMemoryEnabled = $true
  $computer.IsMotherboardEnabled = $true
  $computer.IsStorageEnabled = $true
  $computer.Open()

  for ($index = 0; $index -lt 5; $index++) {
    foreach ($hardware in $computer.Hardware) {
      $hardware.Update()
      foreach ($subHardware in $hardware.SubHardware) {
        $subHardware.Update()
      }
    }
    Start-Sleep -Milliseconds 250
  }

  $rows = @()
  foreach ($hardware in $computer.Hardware) {
    $allSensors = @($hardware.Sensors)
    foreach ($subHardware in $hardware.SubHardware) {
      $allSensors += @($subHardware.Sensors)
    }
    foreach ($sensor in $allSensors) {
      $rows += [pscustomobject]@{
        hardwareName = "$($hardware.Name)"
        name = "$($sensor.Name)"
        type = "$($sensor.SensorType)"
        value = NumberOrNull $sensor.Value
      }
    }
  }

  $computer.Close()
  $json = $rows | ConvertTo-Json -Depth 5
  if ([string]::IsNullOrWhiteSpace($json)) { $json = "[]" }
} catch {
  $json = "[]"
}

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $folder = Split-Path -Parent $OutputPath
  if (-not [string]::IsNullOrWhiteSpace($folder)) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
  }
  Set-Content -Path $OutputPath -Value $json -Encoding UTF8
}

Write-Output $json
