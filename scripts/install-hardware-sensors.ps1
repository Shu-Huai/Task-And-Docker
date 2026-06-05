$ErrorActionPreference = "Stop"

function Assert-Administrator {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run npm run install:sensors from an Administrator PowerShell. CPU temperature and power require elevated hardware sensor access."
  }
}

function Get-LatestLibreHardwareMonitorAsset {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/LibreHardwareMonitor/LibreHardwareMonitor/releases/latest" -Headers @{
    "User-Agent" = "Task-And-Docker"
  }
  $asset = $release.assets |
    Where-Object { $_.name -match "\.zip$" -and $_.name -match "net472|windows|LibreHardwareMonitor" } |
    Select-Object -First 1
  if ($null -eq $asset) {
    $asset = $release.assets | Where-Object { $_.name -match "\.zip$" } | Select-Object -First 1
  }
  if ($null -eq $asset) {
    throw "No Windows zip asset was found in the latest LibreHardwareMonitor release."
  }
  return $asset
}

Assert-Administrator

$repoRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $repoRoot "tools"
$sensorRoot = Join-Path $toolRoot "LibreHardwareMonitor"
$zipPath = Join-Path $toolRoot "LibreHardwareMonitor.zip"
$taskName = "TaskAndDockerHardwareSensors"

New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

Write-Host "Fetching latest LibreHardwareMonitor release..."
$asset = Get-LatestLibreHardwareMonitorAsset

Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -Headers @{
  "User-Agent" = "Task-And-Docker"
}

if (Test-Path $sensorRoot) {
  Remove-Item -Path $sensorRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $sensorRoot | Out-Null

Write-Host "Extracting sensor provider..."
Expand-Archive -Path $zipPath -DestinationPath $sensorRoot -Force

$exe = Get-ChildItem -Path $sensorRoot -Recurse -Filter "LibreHardwareMonitor.exe" | Select-Object -First 1
if ($null -eq $exe) {
  throw "LibreHardwareMonitor.exe was not found after extraction."
}

$userName = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $exe.FullName
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 365)

Write-Host "Registering startup task $taskName..."
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Provides CPU temperature and power sensor WMI data for Task-And-Docker." `
  -Force | Out-Null

Write-Host "Starting sensor provider..."
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 6

$sensorCount = 0
try {
  $sensorCount = @(Get-CimInstance -Namespace "root\LibreHardwareMonitor" -ClassName Sensor -ErrorAction Stop).Count
} catch {
  $sensorCount = 0
}

if ($sensorCount -le 0) {
  Write-Warning "The sensor provider was installed and started, but no WMI sensors were found yet. Confirm LibreHardwareMonitor is allowed to run, then restart this app."
} else {
  Write-Host "Detected $sensorCount sensors. Restart this app, then the hardware page can show CPU temperature and power."
}
