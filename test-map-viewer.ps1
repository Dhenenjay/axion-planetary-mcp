#!/usr/bin/env pwsh

Write-Host "Testing Interactive Map Viewer" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# First create a composite to visualize
Write-Host "Step 1: Creating a composite for visualization..." -ForegroundColor Yellow

$compositeData = @{
    operation = "composite"
    datasetId = "COPERNICUS/S2_SR"
    startDate = "2024-06-01"
    endDate = "2024-08-31"
    region = "Iowa"
    compositeType = "median"
    bands = @("B4", "B3", "B2", "B8")
} | ConvertTo-Json -Depth 3

$compositeResult = Invoke-WebRequest -Uri "http://localhost:3006/mcp" `
    -Method POST `
    -ContentType "application/json" `
    -Body @"
{
    "tool": "earth_engine_process",
    "arguments": $compositeData
}
"@ | Select-Object -ExpandProperty Content | ConvertFrom-Json

if ($compositeResult.success) {
    Write-Host "✓ Composite created: $($compositeResult.compositeKey)" -ForegroundColor Green
    
    # Now create an interactive map
    Write-Host ""
    Write-Host "Step 2: Creating interactive map..." -ForegroundColor Yellow
    
    $mapData = @{
        operation = "create"
        input = $compositeResult.compositeKey
        region = "Iowa"
        bands = @("B4", "B3", "B2")
        visParams = @{
            min = 0
            max = 0.3
            gamma = 1.4
        }
        zoom = 7
        basemap = "satellite"
    } | ConvertTo-Json -Depth 3
    
    $mapResult = Invoke-WebRequest -Uri "http://localhost:3006/mcp" `
        -Method POST `
        -ContentType "application/json" `
        -Body @"
{
    "tool": "earth_engine_map",
    "arguments": $mapData
}
"@ | Select-Object -ExpandProperty Content | ConvertFrom-Json
    
    if ($mapResult.success) {
        Write-Host "✓ Map created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Map Details:" -ForegroundColor Cyan
        Write-Host "  Map ID: $($mapResult.mapId)" -ForegroundColor White
        Write-Host "  URL: $($mapResult.url)" -ForegroundColor Green
        Write-Host "  Region: $($mapResult.region)" -ForegroundColor White
        Write-Host "  Zoom Level: $($mapResult.zoom)" -ForegroundColor White
        Write-Host "  Center: [$($mapResult.center[0]), $($mapResult.center[1])]" -ForegroundColor White
        Write-Host ""
        Write-Host "Instructions:" -ForegroundColor Yellow
        Write-Host "  1. Open this URL in your browser: $($mapResult.url)" -ForegroundColor White
        Write-Host "  2. Use mouse wheel to zoom in/out" -ForegroundColor White
        Write-Host "  3. Drag to pan around the map" -ForegroundColor White
        Write-Host "  4. Use layer control to switch between basemaps" -ForegroundColor White
        
        # Try opening in default browser
        Write-Host ""
        Write-Host "Attempting to open map in browser..." -ForegroundColor Yellow
        Start-Process $mapResult.url
        
    } else {
        Write-Host "✗ Failed to create map: $($mapResult.error)" -ForegroundColor Red
    }
    
} else {
    Write-Host "✗ Failed to create composite: $($compositeResult.error)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green