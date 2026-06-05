$ErrorActionPreference = "Stop"

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

$repoRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $repoRoot "tools"
$sensorRoot = Join-Path $toolRoot "LibreHardwareMonitor"
$zipPath = Join-Path $toolRoot "LibreHardwareMonitor.zip"

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

Write-Host "Installed sensor provider at $($exe.FullName)."
Write-Host "Run npm run dev or npm start. The app will start this provider when hardware metrics are sampled."
