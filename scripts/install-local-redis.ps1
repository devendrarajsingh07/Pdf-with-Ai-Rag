param([string]$Distro = 'Ubuntu-24.04')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/runtime-secrets.ps1"
if ($Distro -notmatch '^[A-Za-z0-9.-]+$') { throw 'Invalid WSL distribution name.' }
# Packages are verified by APT against the official signed repository metadata.
# Extract into a separate prefix; never upgrade/stop another app's Redis instance.
$install = @'
set -eu
. /etc/os-release
test "$ID" = ubuntu && test "$VERSION_ID" = 24.04 || { printf 'This installer requires Ubuntu 24.04.\n' >&2; exit 1; }
test "$(dpkg --print-architecture)" = amd64 || { printf 'This installer requires amd64.\n' >&2; exit 1; }
command -v curl >/dev/null
command -v gpg >/dev/null
getent passwd redis >/dev/null
curl -fsSL --connect-timeout 10 --max-time 30 https://packages.redis.io/gpg -o /tmp/documind-redis-signing.gpg
gpg --batch --yes --dearmor -o /usr/share/keyrings/documind-redis-archive-keyring.gpg /tmp/documind-redis-signing.gpg
printf '%s\n' 'deb [signed-by=/usr/share/keyrings/documind-redis-archive-keyring.gpg] https://packages.redis.io/deb noble main' > /etc/apt/sources.list.d/documind-redis.list
apt-get -o Dir::Etc::sourcelist=/etc/apt/sources.list.d/documind-redis.list -o Dir::Etc::sourceparts=- -o Acquire::https::Timeout=20 -o Acquire::Retries=1 update >/dev/null
install -d -m 755 /opt/documind-redis/packages
cd /opt/documind-redis/packages
apt-get -o Acquire::https::Timeout=20 -o Acquire::Retries=1 download redis-server=6:7.4.11-1rl1~noble1 redis-tools=6:7.4.11-1rl1~noble1 >/dev/null
dpkg-deb -x redis-server_6%3a7.4.11-1rl1~noble1_amd64.deb /opt/documind-redis
dpkg-deb -x redis-tools_6%3a7.4.11-1rl1~noble1_amd64.deb /opt/documind-redis
/opt/documind-redis/usr/bin/redis-server --version
'@
Invoke-DocuMindWslScript $install $Distro
Write-Output 'Installed dedicated Redis binaries. Run scripts/start-secure-local.ps1 next.'
