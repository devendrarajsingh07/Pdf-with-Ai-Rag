param([switch]$SkipBuild, [string]$Distro = 'Ubuntu-24.04', [ValidateRange(1024,65535)][int]$DatabasePort = 5432)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/runtime-secrets.ps1"
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($Distro -notmatch '^[A-Za-z0-9.-]+$') { throw 'Invalid WSL distribution name.' }
# systemd daemons alone do not keep WSL alive; retain an explicit local session.
$keepAlive = Get-CimInstance Win32_Process -Filter "Name = 'wsl.exe'" | Where-Object {
    $_.CommandLine -match ([regex]::Escape("-d $Distro --exec sleep infinity"))
} | Select-Object -First 1
if (-not $keepAlive) {
    Start-Process -FilePath wsl.exe -ArgumentList @('-d', $Distro, '--exec', 'sleep', 'infinity') -WindowStyle Hidden | Out-Null
}
$retainedSecretFile = Join-Path $projectRoot '.tools/secrets/runtime-secrets.clixml'
if (-not (Test-Path -LiteralPath $retainedSecretFile)) {
    $existingService = Invoke-DocuMindWslScript 'test ! -f /etc/documind-redis.conf || printf existing' $Distro
    if ($existingService -eq 'existing') { throw 'Restore the retained secret file before starting an existing managed Redis instance.' }
}
$runtimeSecrets = Get-DocuMindRuntimeSecrets
$redisPassword = $runtimeSecrets.RedisPassword
$previousEnvironment = @{}
foreach ($variableName in @('REDIS_URL', 'DATA_ENCRYPTION_KEY', 'QUEUE_ENABLED', 'DATABASE_URL')) {
    $previousEnvironment[$variableName] = [Environment]::GetEnvironmentVariable($variableName, 'Process')
}
$serviceSource = (Join-Path $PSScriptRoot 'documind-redis.service').Replace('\', '/')
if ($serviceSource -notmatch '^([A-Za-z]):/(.*)$') { throw 'The local Redis service template must be on a Windows drive.' }
$serviceSource = '/mnt/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2]
if ($serviceSource.Contains("'")) { throw 'Single quotes in the workspace path are not supported.' }
# Password goes through stdin, not command-line arguments or a .env file.
$redisSetup = @"
set -eu
test -x /opt/documind-redis/usr/bin/redis-server
install -d -m 700 -o redis -g redis /var/lib/documind-redis
umask 077
printf '%s\n' 'bind 127.0.0.1 ::1' 'protected-mode yes' 'port 6380' 'daemonize no' 'supervised systemd' 'dir /var/lib/documind-redis' 'appendonly yes' 'appendfsync everysec' 'maxmemory 256mb' 'maxmemory-policy noeviction' 'requirepass $redisPassword' > /etc/documind-redis.conf
chown redis:redis /etc/documind-redis.conf
chmod 600 /etc/documind-redis.conf
install -m 644 '$serviceSource' /etc/systemd/system/documind-redis.service
systemctl daemon-reload
systemctl enable documind-redis.service >/dev/null 2>&1
systemctl start documind-redis.service
systemctl is-active --quiet documind-redis.service
"@
Invoke-DocuMindWslScript $redisSetup $Distro | Out-Null
try {
$env:REDIS_URL = "redis://:$redisPassword@127.0.0.1:6380/0"
$env:DATA_ENCRYPTION_KEY = $runtimeSecrets.EncryptionKey
$env:QUEUE_ENABLED = 'true'
if ($DatabasePort -ne 5432) {
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        # Capture privately; credentials never appear in command arguments or logs.
        $databaseConnection = & node.exe -e "require('dotenv').config();const u=new URL(process.env.DATABASE_URL);u.hostname='127.0.0.1';u.port='$DatabasePort';process.stdout.write(u.href)"
        if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the local database configuration.' }
        $env:DATABASE_URL = $databaseConnection
        $databaseConnection = $null
    } finally { Pop-Location }
}

# WSL loopback forwarding can lag behind the systemd listener. Authenticate first.
Push-Location (Join-Path $projectRoot 'backend')
try {
    & node.exe -e "const {createClient}=require('redis'); (async()=>{for(let i=0;i<30;i++){const c=createClient({url:process.env.REDIS_URL,socket:{connectTimeout:1000,reconnectStrategy:false}});c.on('error',()=>{});try{await c.connect();await c.ping();await c.quit();console.log('Authenticated Redis connectivity verified');return}catch{if(c.isOpen)await c.disconnect();await new Promise(r=>setTimeout(r,500))}}process.exitCode=1})().catch(()=>{process.exitCode=1})"
    if ($LASTEXITCODE -ne 0) { throw 'Windows-to-WSL Redis authentication failed; app services were not restarted.' }
} finally { Pop-Location }

function Stop-VerifiedAppListener([int]$Port, [string]$ExpectedCommand) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return }
    $appProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    if (-not $appProcess -or $appProcess.CommandLine -notmatch $ExpectedCommand) { throw "Port $Port is owned by an unexpected process; refusing to stop it." }
    & taskkill.exe /PID $appProcess.ProcessId /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not stop verified app process on port $Port." }
}

    Stop-VerifiedAppListener 8000 'python311-portable.*uvicorn app.main:app.*8000'
    Stop-VerifiedAppListener 3001 'node.*(?:dist[/\\]server\.js)'
    if (-not $SkipBuild) { Stop-VerifiedAppListener 3000 'node.*(?:start-standalone\.cjs|standalone[/\\]server\.js)' }
    & "$PSScriptRoot/start-local.ps1" -SkipBuild:$SkipBuild -DatabasePort $DatabasePort
    $readiness = Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/health/readiness' -TimeoutSec 15
    if (-not $readiness.success) { throw 'Coordinated readiness did not pass.' }
    Write-Output 'Real Redis and encrypted queue mode are active. Runtime secrets retained with CurrentUser DPAPI.'
} finally {
    foreach ($variableName in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($variableName, $previousEnvironment[$variableName], 'Process')
    }
    $runtimeSecrets = $null
    $redisPassword = $null
    $redisSetup = $null
}
