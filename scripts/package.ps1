$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -Raw -LiteralPath (Join-Path $root 'manifest.json') | ConvertFrom-Json
$id = $manifest.id
if ($id -notmatch '^[a-z]+(?:-[a-z]+)*$' -or $id -match 'obsidian|plugin$') { throw 'Invalid community plugin ID' }
$dist = Join-Path $root 'dist'
$folder = Join-Path $dist $id
$null = New-Item -Path $folder -ItemType Directory -Force
$zip = Join-Path $dist "obsidian-$id.zip"
$stream = [IO.File]::Create($zip)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $assets = @('main.js', 'manifest.json')
        if (Test-Path -LiteralPath (Join-Path $root 'styles.css') -PathType Leaf) { $assets += 'styles.css' }
        foreach ($name in $assets) {
            $file = Join-Path $folder $name
            Copy-Item -LiteralPath (Join-Path $root $name) -Destination $file -Force
            $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file, "$id/$name")
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Write-Output $zip
