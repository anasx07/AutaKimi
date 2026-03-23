$widgetsPath = "src\renderer\src\widgets"

function Fix-Widget($name, $file) {
    $dir = Join-Path $widgetsPath $name
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -ErrorAction SilentlyContinue
    }
    $src = Join-Path $widgetsPath $file
    $dest = Join-Path $dir $file
    if (Test-Path $src) {
        Move-Item -Path $src -Destination $dest -Force
    }
}

# MangaDetails
if (Test-Path "src\renderer\src\widgets\MangaDetailsRaw.tsx") {
    $destDir = "src\renderer\src\widgets\manga-details"
    if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -ErrorAction SilentlyContinue }
    Move-Item -Path "src\renderer\src\widgets\MangaDetailsRaw.tsx" -Destination "src\renderer\src\widgets\manga-details\MangaDetails.tsx" -Force
}

# Others
Fix-Widget "reader" "ReaderRaw.tsx"
Fix-Widget "title-bar" "TitleBarRaw.tsx"
Fix-Widget "extensions-manager" "ExtensionsManagerRaw.tsx"
Fix-Widget "download-queue" "DownloadQueueRaw.tsx"

# Also handle those that might still be extensionless files
Fix-Widget "reader" "reader"
Fix-Widget "title-bar" "title-bar"
Fix-Widget "extensions-manager" "extensions-manager"
Fix-Widget "download-queue" "download-queue"

# Rename internal files if they were moved without extension
if (Test-Path "src\renderer\src\widgets\reader\reader") { Move-Item -Path "src\renderer\src\widgets\reader\reader" -Destination "src\renderer\src\widgets\reader\ChapterReader.tsx" -Force }
if (Test-Path "src\renderer\src\widgets\title-bar\title-bar") { Move-Item -Path "src\renderer\src\widgets\title-bar\title-bar" -Destination "src\renderer\src\widgets\title-bar\TitleBar.tsx" -Force }
if (Test-Path "src\renderer\src\widgets\extensions-manager\extensions-manager") { Move-Item -Path "src\renderer\src\widgets\extensions-manager\extensions-manager" -Destination "src\renderer\src\widgets\extensions-manager\ExtensionsManager.tsx" -Force }
if (Test-Path "src\renderer\src\widgets\download-queue\download-queue") { Move-Item -Path "src\renderer\src\widgets\download-queue\download-queue" -Destination "src\renderer\src\widgets\download-queue\DownloadQueueProcessor.tsx" -Force }

# Cleanup
if (Test-Path "src\renderer\src\widgets\manga-details-dir") { Remove-Item -Path "src\renderer\src\widgets\manga-details-dir" -Recurse -Force }
