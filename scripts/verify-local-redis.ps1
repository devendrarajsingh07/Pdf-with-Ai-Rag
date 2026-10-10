$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/runtime-secrets.ps1"
$runtimeSecrets = Get-DocuMindRuntimeSecrets
$previousEnvironment = @{}
foreach ($variableName in @('REDIS_URL', 'DATA_ENCRYPTION_KEY', 'QUEUE_ENABLED')) {
    $previousEnvironment[$variableName] = [Environment]::GetEnvironmentVariable($variableName, 'Process')
}
try {
    $env:REDIS_URL = "redis://:$($runtimeSecrets.RedisPassword)@127.0.0.1:6380/0"
    $env:DATA_ENCRYPTION_KEY = $runtimeSecrets.EncryptionKey
    $env:QUEUE_ENABLED = 'true'
    Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'backend')
    try {
        & node.exe "$PSScriptRoot/verify-local-redis.cjs"
        if ($LASTEXITCODE -ne 0) { throw 'Real Redis checks failed.' }
    } finally { Pop-Location }
    Invoke-DocuMindWslScript 'set -eu; grep -E "^(appendonly|appendfsync|maxmemory|maxmemory-policy|bind|protected-mode) " /etc/documind-redis.conf; test -s /var/lib/documind-redis/appendonlydir/appendonly.aof.manifest; printf "AOF manifest exists\n"'
} finally {
    foreach ($variableName in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($variableName, $previousEnvironment[$variableName], 'Process')
    }
    $runtimeSecrets = $null
}
