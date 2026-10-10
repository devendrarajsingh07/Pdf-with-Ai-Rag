param([switch]$SkipBuild, [ValidateRange(1024,65535)][int]$DatabasePort = 5432)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot '.tools'
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

function Test-LocalPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return ($task.Wait(500) -and $client.Connected)
    } catch { return $false } finally { $client.Dispose() }
}

function Start-LocalService([string]$Name, [int]$Port, [string]$Executable, [string[]]$Arguments, [string]$Directory) {
    if (Test-LocalPort $Port) {
        Write-Output "$Name already has a listener on port $Port; keeping it running."
        return
    }
    $service = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $toolsRoot "$Name.out.log") -RedirectStandardError (Join-Path $toolsRoot "$Name.err.log") -PassThru
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-LocalPort $Port) {
            Write-Output "$Name started on port $Port (PID $($service.Id))."
            return
        }
        if ($service.HasExited) { throw "$Name exited; see .tools/$Name.err.log and .tools/$Name.out.log." }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not start on port $Port; inspect .tools/$Name.err.log."
}

$pythonPath = Join-Path $toolsRoot 'python311-portable/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Local Python is missing; install the ML requirements first.' }

if (-not $SkipBuild) {
    foreach ($package in @('backend', 'frontend')) {
        Push-Location (Join-Path $projectRoot $package)
        try {
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) { throw "$package build failed." }
        } finally { Pop-Location }
    }
}

if (-not (Test-LocalPort $DatabasePort)) {
    & (Join-Path $projectRoot 'postgres-bin/pgsql/bin/pg_ctl.exe') -D (Join-Path $projectRoot 'postgres-data') -l (Join-Path $toolsRoot 'postgres.out.log') -o "-p $DatabasePort -h 127.0.0.1" start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start.' }
}

Start-LocalService 'qdrant' 6333 (Join-Path $projectRoot 'qdrant-server/qdrant.exe') @('--disable-telemetry') (Join-Path $projectRoot 'qdrant-server')

Push-Location (Join-Path $projectRoot 'backend')
try {
    & npm.cmd run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
} finally { Pop-Location }

Start-LocalService 'ml-service' 8000 $pythonPath @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') (Join-Path $projectRoot 'ml-service')
Start-LocalService 'backend' 3001 'node.exe' @('dist/server.js') (Join-Path $projectRoot 'backend')
Start-LocalService 'frontend' 3000 'node.exe' @('scripts/start-standalone.cjs') (Join-Path $projectRoot 'frontend')

foreach ($url in @('http://localhost:6333/healthz', 'http://localhost:8000/api/v1/ml/health', 'http://localhost:3001/api/v1/health', 'http://localhost:3000')) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
    Write-Output "$url : HTTP $($response.StatusCode)"
}
Write-Output 'Open http://localhost:3000. Logs are in .tools/. Keep using localhost for cookie authentication.'
