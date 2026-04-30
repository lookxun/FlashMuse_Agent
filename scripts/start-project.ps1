param([switch]$Worker)

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"
$log = Join-Path $root "start-project.log"

if (-not $Worker) {
  $scriptPath = '"' + $PSCommandPath + '"'
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $scriptPath,
    "-Worker"
  )
  exit
}

function Test-Ready {
  try {
    $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-Ready)) {
  Start-Process cmd.exe `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -ArgumentList "/c npm run dev > start-project.log 2>&1"
}

for ($i = 0; $i -lt 240; $i++) {
  if (Test-Ready) {
    Start-Process $url
    exit
  }

  Start-Sleep -Milliseconds 250
}

Add-Content $log "Startup timed out. Please check Node/npm or whether port 3000 is occupied."
Start-Process notepad.exe $log
