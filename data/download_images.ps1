$inventoryPath = "data/inventory.json"
$imageDir = "images/machines"

if (!(Test-Path $imageDir)) {
    New-Item -ItemType Directory -Path $imageDir -Force | Out-Null
}

$machines = Get-Content -Raw $inventoryPath | ConvertFrom-Json
$userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

foreach ($m in $machines) {
    if ($m.sourceImageUrl) {
        # Check if already exists
        $targetPath = Join-Path $imageDir "$($m.id).jpg"
        if (!(Test-Path $targetPath)) {
            Write-Host "Downloading $($m.name) from $($m.sourceImageUrl)..."
            try {
                Invoke-WebRequest -Uri $m.sourceImageUrl -OutFile $targetPath -UserAgent $userAgent -TimeoutSec 60
                Write-Host "Success: $targetPath"
            }
            catch {
                Write-Host "Error downloading $($m.id): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        else {
            Write-Host "Already exists: $($m.id).jpg"
        }
    }
}
