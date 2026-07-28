param([switch]$Worker)

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"
$healthUrl = "http://127.0.0.1:3000"
# The homepage stays fine even when the .next route manifest is corrupted, so the
# real health probe must hit an API route. /api/auth/me returns 200 {"user":null}
# when logged out, and 404 when the route table is broken.
$apiHealthUrl = "http://127.0.0.1:3000/api/auth/me"
$log = Join-Path $root "start-project.log"
# A separate trace file: start-project.log is also the npm/next stdout sink, so
# branch decisions get buried there. This one only ever records our own steps.
$traceLog = Join-Path $root ".runtime\start-project-trace.log"

function Write-Trace {
  param([string]$Message)

  try {
    $dir = Split-Path -Parent $traceLog
    if (-not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Add-Content -LiteralPath $traceLog -Value ("[" + (Get-Date -Format "HH:mm:ss") + "] pid=" + $PID + " " + $Message)
  } catch {
  }
}

function Open-AppUrl {
  Start-Process "explorer.exe" $url
}

Write-Trace "launcher started (Worker=$Worker)"

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

function Write-Log {
  param([string]$Message)

  Write-Trace $Message

  # start-project.log is held open by the running "npm run dev >> start-project.log"
  # redirect, so writing to it throws IOException while a dev server is alive.
  # That used to abort this whole script, which is exactly why double-clicking the
  # launcher could never repair a broken dev server. Logging must never be fatal.
  try {
    if (-not (Test-Path -LiteralPath $log)) {
      Set-Content -LiteralPath $log -Value $Message -Encoding UTF8 -ErrorAction Stop
      return
    }

    Add-Content -LiteralPath $log -Value $Message -ErrorAction Stop
  } catch {
  }
}

function Reset-Log {
  param([string]$Message)

  Write-Trace $Message

  try {
    Set-Content -LiteralPath $log -Value $Message -Encoding UTF8 -ErrorAction Stop
  } catch {
  }
}


function Test-Ready {
  try {
    $response = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-ApiStatus {
  param([int]$TimeoutSec = 120)

  try {
    $response = Invoke-WebRequest $apiHealthUrl -UseBasicParsing -TimeoutSec $TimeoutSec
    return [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }

    return -1
  }
}

# Require several consecutive failures before declaring the cache broken, so a
# slow first compile never triggers a needless .next wipe.
function Test-ApiHealthy {
  param(
    [int]$Attempts = 3,
    [int]$TimeoutSec = 120
  )

  for ($i = 1; $i -le $Attempts; $i++) {
    $status = Get-ApiStatus -TimeoutSec $TimeoutSec
    if ($status -eq 200) {
      return $true
    }

    Write-Log "API health probe attempt $i returned status $status (expected 200)."
    Start-Sleep -Seconds 2
  }

  return $false
}

# Only ever kills node.exe, so an unrelated process holding the port is left alone.
function Stop-NodeOnPort {
  param([int]$Port)

  $owners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($owner in $owners) {
    $process = Get-Process -Id $owner -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "node") {
      Write-Log "Stopping the dev server holding port $Port (PID $owner)."
      Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-DevServer {
  # A corrupted cache leaves a zombie dev server holding port 3000; a previous
  # failed repair may also have left one on 3001. Both must go, otherwise the
  # new dev server picks another port and the health probe waits forever.
  Stop-NodeOnPort 3000
  Stop-NodeOnPort 3001

  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$root*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*npm run dev*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  Start-Sleep -Seconds 3
}

# Keep the small manifest/type files of a broken cache so the root cause can be
# diagnosed later. .runtime is already git-ignored.
function Backup-BrokenNextCache {
  try {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $target = Join-Path $root ".runtime\next-broken\$stamp"
    New-Item -ItemType Directory -Path $target -Force | Out-Null

    $typesDir = Join-Path $root ".next\dev\types"
    if (Test-Path -LiteralPath $typesDir) {
      Copy-Item -LiteralPath $typesDir -Destination (Join-Path $target "types") -Recurse -Force -ErrorAction SilentlyContinue
    }

    Get-ChildItem -LiteralPath (Join-Path $root ".next") -Recurse -File -Filter "*manifest*.json" -ErrorAction SilentlyContinue |
      Select-Object -First 200 |
      ForEach-Object {
        $flatName = $_.FullName.Substring((Join-Path $root ".next").Length).TrimStart("\").Replace("\", "__")
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $target $flatName) -Force -ErrorAction SilentlyContinue
      }

    Write-Log "Saved a copy of the broken .next manifests to .runtime\next-broken\$stamp for later diagnosis."
  } catch {
    Write-Log "Could not back up the broken .next cache: $($_.Exception.Message)"
  }
}

function Repair-NextCache {
  Write-Trace "Repair-NextCache: begin"
  Write-Log ""
  Write-Log "Repairing the .next cache (stop dev server, back up manifests, delete .next, restart)..."
  Stop-DevServer
  Backup-BrokenNextCache
  Remove-Item -LiteralPath (Join-Path $root ".next") -Recurse -Force -ErrorAction SilentlyContinue
  Write-Trace ("Repair-NextCache: done, .next exists=" + (Test-Path -LiteralPath (Join-Path $root ".next")))
}

function Start-DevServerAndWait {
  Start-Process cmd.exe `
      -WorkingDirectory $root `
      -WindowStyle Hidden `
      -ArgumentList "/c npm run dev >> start-project.log 2>&1"

  for ($i = 0; $i -lt 600; $i++) {
    if (Test-Ready) {
      return $true
    }

    Start-Sleep -Milliseconds 500
  }

  return Test-Ready
}

# Next binds port 3000 on the IPv6 wildcard (::), so the old 500ms IPv4-only
# TcpClient probe reported "free" while a zombie dev server was still holding it.
# Asking the OS for listeners is both exact and instant.
function Test-DevPortBusy {
  param([int]$Port = 3000)

  return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue).Count -gt 0
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 500
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-DockerReady {
  cmd.exe /c "docker info >nul 2>&1"
  return $LASTEXITCODE -eq 0
}

function Start-DockerDesktopIfAvailable {
  $dockerDesktopPath = Join-Path $Env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path -LiteralPath $dockerDesktopPath)) {
    return $false
  }

  Start-Process -FilePath $dockerDesktopPath | Out-Null

  for ($i = 0; $i -lt 5; $i++) {
    if (Test-DockerReady) {
      return $true
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Invoke-LoggedCommand {
  param(
    [string]$Command,
    [string]$FailureMessage
  )

  Write-Log ""
  Write-Log "> $Command"

  $process = Start-Process cmd.exe `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -Wait `
    -PassThru `
    -ArgumentList "/c $Command >> start-project.log 2>&1"

  if ($process.ExitCode -ne 0) {
    Write-Log $FailureMessage
    Start-Process notepad.exe $log
    return $false
  }

  return $true
}

$mutex = New-Object System.Threading.Mutex($false, "YinzaoStartProjectMutex")
$owned = $false
try {
  $owned = $mutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
  # A previous run was killed while holding the mutex; we inherit it.
  $owned = $true
}

# Another instance is working. Wait for it to make the app healthy, but never
# exit silently just because it holds the lock: if that instance is stuck or
# already gave up, this run must be allowed to repair things itself. That silent
# exit is why double-clicking the launcher sometimes "did nothing".
if (-not $owned) {
  Write-Trace "another instance holds the mutex; waiting for it"
  for ($i = 0; $i -lt 6; $i++) {
    if (Test-ApiHealthy -Attempts 1 -TimeoutSec 20) {
      Open-AppUrl
      exit
    }

    Start-Sleep -Seconds 10
  }
}

try {
  # A dev server is already holding port 3000. Reuse it ONLY when its API routes
  # really answer 200. A corrupted .next cache makes both the homepage and the
  # API fail, so the old "is the homepage up?" probe wrongly concluded "not
  # started yet" and the fresh dev server got pushed onto port 3001 while the
  # zombie kept port 3000 -> the wait loop then timed out after 5 minutes.
  Write-Trace ("mutex owned=" + $owned + " port3000busy=" + (Test-DevPortBusy 3000))
  if (Test-DevPortBusy 3000) {
    Reset-Log "Port 3000 is already in use. Checking whether that dev server is actually healthy..."

    if (Test-ApiHealthy -Attempts 2 -TimeoutSec 60) {
      Open-AppUrl
      exit
    }

    Write-Trace "port busy but API unhealthy -> repairing"
    Write-Log "That dev server does not serve its API routes (a corrupted .next cache). Repairing automatically..."
    Repair-NextCache
  } else {
    Reset-Log "Starting Yinzao dev server..."
  }

  if (-not (Test-TcpPort "127.0.0.1" 5432)) {
    if (-not (Test-DockerReady)) {
      Write-Log ""
      Write-Log "Docker Desktop is not ready. Trying to start Docker Desktop..."

      if (-not (Start-DockerDesktopIfAvailable)) {
        Write-Log "Docker Desktop did not become ready within 5 seconds. Please restart Docker Desktop manually, wait until it finishes starting, then run this script again."
        Start-Process notepad.exe $log
        exit
      }
    }

    if (-not (Invoke-LoggedCommand "docker compose up -d" "Failed to start local PostgreSQL. Please restart Docker Desktop and try again.")) {
      exit
    }
  } else {
    Write-Log "Local PostgreSQL is already listening on 127.0.0.1:5432. Skipping Docker startup."
  }

  $prismaCommand = "npx prisma migrate deploy"
  if (Test-Path -LiteralPath (Join-Path $root "node_modules\.bin\prisma.cmd")) {
    $prismaCommand = "node_modules\.bin\prisma.cmd migrate deploy"
  }

  if (-not (Invoke-LoggedCommand $prismaCommand "Failed to apply database migrations. Please check start-project.log.")) {
    exit
  }

  # Boot the dev server, verify the API routes, and self-heal once if the cache
  # turns out to be corrupted.
  if (Start-DevServerAndWait) {
    if (Test-ApiHealthy) {
      Open-AppUrl
      exit
    }

    Write-Log "The dev server started but its API routes are broken (a corrupted .next cache). Repairing automatically..."
    Repair-NextCache

    if (Start-DevServerAndWait) {
      if (Test-ApiHealthy) {
        Write-Log "Repair succeeded. The API routes respond with 200 again."
        Open-AppUrl
        exit
      }
    }

    Write-Log "Repair did not help. Please send this log to the developer."
    Start-Process notepad.exe $log
    exit
  }

  Write-Log "Startup timed out. Please check Node/npm or whether port 3000 is occupied."
  Start-Process notepad.exe $log
} finally {
  if ($owned) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}


