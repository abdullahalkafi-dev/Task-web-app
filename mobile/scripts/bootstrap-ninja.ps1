$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$destination = [IO.Path]::GetFullPath((Join-Path $workspace '.tools\ninja'))
if (-not $destination.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Tools path escaped workspace' }
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$archive = Join-Path $destination 'ninja-win.zip'
Invoke-WebRequest -Uri 'https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip' -OutFile $archive -UseBasicParsing
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash -ne '07FC8261B42B20E71D1720B39068C2E14FFCEE6396B76FB7A795FB460B78DC65') { throw 'Ninja download checksum mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
& (Join-Path $destination 'ninja.exe') --version
