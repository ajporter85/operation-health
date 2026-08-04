<#
    snapshot-ideas.ps1 - last-known-good copies of docs/ideas

    Why this exists: docs/ideas/ is gitignored (it holds private health detail),
    so git is NOT a safety net for it. The Claude Desktop filesystem connector has
    WRITE access to that folder, which means a bad overwrite there is unrecoverable.
    This makes timestamped copies somewhere the connector cannot reach.

    Destination is deliberately OUTSIDE the repo and outside the connector's scope,
    so it can never be committed and can never be edited by the connector.

    NOTE: keep this file pure ASCII. Windows PowerShell 5.1 reads .ps1 as ANSI
    when there is no BOM, so smart quotes / em dashes break the parser.

    Run it:      powershell -ExecutionPolicy Bypass -File .\snapshot-ideas.ps1
    Schedule it: see the note at the bottom of this file.
#>

[CmdletBinding()]
param(
    # How many snapshots to keep before the oldest are pruned.
    [int] $Keep = 30,

    # Take a snapshot even if nothing has changed since the last one.
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'docs\ideas'
$root   = Join-Path $env:USERPROFILE 'OperationHealth-Backups\ideas-snapshots'

if (-not (Test-Path $source)) {
    Write-Error "Source folder not found: $source"
}

$files = Get-ChildItem $source -File | Sort-Object Name
if ($files.Count -eq 0) {
    Write-Output "Nothing to snapshot - $source is empty."
    return
}

# Fingerprint the current contents so identical back-to-back runs are skipped.
# Keeps a scheduled run from filling the folder with duplicates.
$lines = foreach ($f in $files) {
    $hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
    "{0}  {1}" -f $f.Name, $hash
}
$manifest = $lines -join [Environment]::NewLine

if (-not (Test-Path $root)) {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
}

$previous = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1

if ((-not $Force) -and $previous) {
    $prevManifest = Join-Path $previous.FullName '_manifest.txt'
    if (Test-Path $prevManifest) {
        $prev = (Get-Content $prevManifest -Raw).TrimEnd()
        if ($prev -eq $manifest) {
            Write-Output "No changes since $($previous.Name) - skipped. Use -Force to snapshot anyway."
            return
        }
    }
}

# Millisecond resolution plus a collision guard. Second-resolution stamps let two
# runs inside the same second land in the same folder, which silently overwrites
# the previous snapshot - the exact data loss this script exists to prevent.
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss_fff'
$dest  = Join-Path $root $stamp
$n     = 1
while (Test-Path $dest) {
    $dest = Join-Path $root ("{0}-{1}" -f $stamp, $n)
    $n++
}
New-Item -ItemType Directory -Path $dest | Out-Null

foreach ($f in $files) {
    Copy-Item $f.FullName -Destination $dest
}
$manifest | Out-File (Join-Path $dest '_manifest.txt') -Encoding utf8

Write-Output "Snapshot $stamp : $($files.Count) file(s) copied to $dest"

# Prune oldest beyond -Keep.
$all = Get-ChildItem $root -Directory | Sort-Object Name -Descending
if ($all.Count -gt $Keep) {
    $stale = $all | Select-Object -Skip $Keep
    foreach ($s in $stale) {
        Remove-Item $s.FullName -Recurse -Force -Confirm:$false
    }
    Write-Output "Pruned $($stale.Count) old snapshot(s), keeping the newest $Keep."
}

<#
    To run this automatically once a day, from an ADMIN PowerShell prompt:

      $arg = '-NoProfile -ExecutionPolicy Bypass -File "D:\ProjectHealth\snapshot-ideas.ps1"'
      $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
      $t = New-ScheduledTaskTrigger -Daily -At 6pm
      $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
      Register-ScheduledTask -TaskName 'OperationHealth-SnapshotIdeas' -Action $a -Trigger $t -Settings $s

    -StartWhenAvailable is NOT optional. Without it a run scheduled while the PC is
    off is skipped outright - Task Scheduler does not catch up at boot - so the
    backup silently stops happening on any day the machine was off at 6pm.

    To restore: copy the file you want back out of the snapshot folder.
#>
