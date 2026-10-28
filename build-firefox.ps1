$ErrorActionPreference = "Stop"

$outputDirectory = Join-Path $PSScriptRoot "firefox-build"
$filesToCopy = @(
  "background.js",
  "page-agent-bridge.js",
  "page-agent.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "presets.js",
  "settings.css",
  "settings.html",
  "settings.js"
)

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot "manifest.firefox.json") `
  -Destination (Join-Path $outputDirectory "manifest.json") -Force

foreach ($file in $filesToCopy) {
  Copy-Item -Path (Join-Path $PSScriptRoot $file) `
    -Destination (Join-Path $outputDirectory $file) -Force
}

Write-Output "Firefox extension package created at: $outputDirectory"
