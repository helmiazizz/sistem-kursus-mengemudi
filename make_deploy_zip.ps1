$sourceDir = "d:\Kuliah\Semester 6\Kerja Praktek\sistem-mobil"
$zipPath = "d:\Kuliah\Semester 6\Kerja Praktek\sistem-mobil-deploy.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

$tempDir = Join-Path $env:TEMP "sistem-mobil-temp-zip"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $tempDir | Out-Null

$itemsToInclude = @("admin", "config", "database", "public", "routes", "package.json", "package-lock.json", "server.js", ".env", ".env.example")
foreach ($item in $itemsToInclude) {
    $itemPath = Join-Path $sourceDir $item
    if (Test-Path $itemPath) {
        Copy-Item -Path $itemPath -Destination $tempDir -Recurse -Force
    }
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath
Remove-Item -Recurse -Force $tempDir

$zipItem = Get-Item $zipPath
Write-Output "SUCCESS: $($zipItem.FullName) created. Size: $([math]::round($zipItem.Length / 1MB, 2)) MB ($($zipItem.Length) bytes)"
