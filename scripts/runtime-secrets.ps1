# Windows-only local secret retention. Never print the returned secret values.
Set-StrictMode -Version Latest

function Get-DocuMindRuntimeSecrets {
    $secretRoot = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools/secrets'
    $secretFile = Join-Path $secretRoot 'runtime-secrets.clixml'
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if ($identity.Name -match 'CodexSandbox') { throw 'Run secret provisioning as the Windows app owner, not the sandbox account.' }
    if (-not (Test-Path -LiteralPath $secretFile)) {
        # Never generate a replacement key over existing encrypted database jobs.
        $backendRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend'
        Push-Location $backendRoot
        try {
            & node.exe -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query('SELECT count(*)::int AS count FROM request_jobs').then(r=>{if(r.rows[0].count)process.exitCode=2}).catch(()=>{process.exitCode=1}).finally(()=>p.end())"
            if ($LASTEXITCODE -ne 0) { throw 'Cannot create a new key: restore the existing key or verify that no encrypted jobs remain.' }
        } finally { Pop-Location }
        New-Item -ItemType Directory -Path $secretRoot -Force | Out-Null
        $sid = $identity.User.Value
        & icacls.exe $secretRoot /inheritance:r /grant:r "*${sid}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the secret directory ACL.' }
        $keyBytes = New-Object byte[] 32
        $passwordBytes = New-Object byte[] 32
        [Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
        [Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
        $secretRecord = [pscustomobject]@{
            Version = 1
            OwnerSid = $sid
            CreatedUtc = [DateTime]::UtcNow.ToString('o')
            EncryptionKey = (ConvertTo-SecureString ([Convert]::ToBase64String($keyBytes)) -AsPlainText -Force)
            RedisPassword = (ConvertTo-SecureString ([Convert]::ToHexString($passwordBytes)) -AsPlainText -Force)
        }
        # Export-Clixml encrypts SecureString using Windows CurrentUser DPAPI.
        $secretRecord | Export-Clixml -LiteralPath $secretFile
        [Array]::Clear($keyBytes, 0, $keyBytes.Length)
        [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    }
    $retained = Import-Clixml -LiteralPath $secretFile
    if ($retained.OwnerSid -ne $identity.User.Value) { throw 'The secret file belongs to another Windows account.' }
    $secrets = @{
        EncryptionKey = [Net.NetworkCredential]::new('', $retained.EncryptionKey).Password
        RedisPassword = [Net.NetworkCredential]::new('', $retained.RedisPassword).Password
    }
    if ($secrets.RedisPassword -notmatch '^[0-9A-F]{64}$' -or
        $secrets.EncryptionKey -notmatch '^[A-Za-z0-9+/]{43}=$') {
        throw 'Invalid retained secret format; restore the protected secret file.'
    }
    return $secrets
}

function Invoke-DocuMindWslScript([string]$Script, [string]$Distro = 'Ubuntu-24.04') {
    $info = [Diagnostics.ProcessStartInfo]::new('wsl.exe')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in @('-d', $Distro, '-u', 'root', '--', 'sh', '-s')) { $info.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($info)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.Write($Script.Replace("`r`n", "`n"))
    $process.StandardInput.Close()
    if (-not $process.WaitForExit(60000)) { throw 'WSL operation exceeded 60 seconds; check its status before retrying.' }
    # Never echo shell errors that might contain secret configuration text.
    if ($process.ExitCode -ne 0) { throw 'WSL Redis operation failed; inspect the restricted service logs locally.' }
    return $stdout.GetAwaiter().GetResult().Trim()
}
