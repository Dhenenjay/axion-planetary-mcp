#!/usr/bin/env pwsh

Write-Host ""
Write-Host "=== FIXING MULTI-LAYER MAPS ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create a base composite
Write-Host "Step 1: Creating base composite for Los Angeles..." -ForegroundColor Yellow

$compositeBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "composite"
        datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        region = "Los Angeles"
        startDate = "2024-10-01"
        endDate = "2024-10-31"
        compositeType = "median"
    }
} | ConvertTo-Json -Depth 10 -Compress

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
$result = $response.Content | ConvertFrom-Json

if ($result.success) {
    $compositeKey = $result.compositeKey
    Write-Host "  Success! Composite key: $compositeKey" -ForegroundColor Green
} else {
    Write-Host "  Failed to create composite" -ForegroundColor Red
    exit 1
}

# Step 2: Create NDVI index
Write-Host ""
Write-Host "Step 2: Creating NDVI index..." -ForegroundColor Yellow

$ndviBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        input = $compositeKey
        indexType = "NDVI"
    }
} | ConvertTo-Json -Depth 10 -Compress

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -Body $ndviBody -ContentType "application/json" -UseBasicParsing
$ndviResult = $response.Content | ConvertFrom-Json

if ($ndviResult.success) {
    $ndviKey = $ndviResult.indexKey
    Write-Host "  Success! NDVI key: $ndviKey" -ForegroundColor Green
} else {
    Write-Host "  Failed to create NDVI" -ForegroundColor Red
}

# Step 3: Create NDWI index
Write-Host ""
Write-Host "Step 3: Creating NDWI index..." -ForegroundColor Yellow

$ndwiBody = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        input = $compositeKey
        indexType = "NDWI"
    }
} | ConvertTo-Json -Depth 10 -Compress

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -Body $ndwiBody -ContentType "application/json" -UseBasicParsing
$ndwiResult = $response.Content | ConvertFrom-Json

if ($ndwiResult.success) {
    $ndwiKey = $ndwiResult.indexKey
    Write-Host "  Success! NDWI key: $ndwiKey" -ForegroundColor Green
} else {
    Write-Host "  Failed to create NDWI" -ForegroundColor Red
}

# Step 4: Create multi-layer map
Write-Host ""
Write-Host "Step 4: Creating multi-layer interactive map..." -ForegroundColor Yellow

$mapBody = @{
    tool = "earth_engine_map"
    arguments = @{
        operation = "create"
        input = $compositeKey
        region = "Los Angeles"
        layers = @(
            @{
                name = "True Color"
                bands = @("B4", "B3", "B2")
                visParams = @{
                    min = 0
                    max = 0.3
                    gamma = 1.4
                }
            },
            @{
                name = "False Color (Vegetation)"
                bands = @("B8", "B4", "B3")
                visParams = @{
                    min = 0
                    max = 0.3
                    gamma = 1.4
                }
            },
            @{
                name = "NDVI"
                input = $ndviKey
                bands = @("NDVI")
                visParams = @{
                    min = -0.2
                    max = 0.8
                    palette = @("blue", "white", "green")
                }
            },
            @{
                name = "NDWI"
                input = $ndwiKey
                bands = @("NDWI")
                visParams = @{
                    min = -0.5
                    max = 0.5
                    palette = @("red", "white", "blue")
                }
            }
        )
        center = @(-118.2437, 34.0522)
        zoom = 10
        basemap = "satellite"
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "  Sending request to create map..." -ForegroundColor Gray

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
$mapResult = $response.Content | ConvertFrom-Json

if ($mapResult.success) {
    Write-Host ""
    Write-Host "=== SUCCESS! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Multi-layer map created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Map Details:" -ForegroundColor Cyan
    Write-Host "  Map ID: $($mapResult.mapId)" -ForegroundColor White
    Write-Host "  URL: $($mapResult.url)" -ForegroundColor Yellow
    Write-Host "  Region: $($mapResult.region)" -ForegroundColor White
    Write-Host "  Center: [$($mapResult.center[0]), $($mapResult.center[1])]" -ForegroundColor White
    Write-Host "  Zoom: $($mapResult.zoom)" -ForegroundColor White
    Write-Host ""
    Write-Host "Layers in this map:" -ForegroundColor Cyan
    foreach ($layer in $mapResult.layers) {
        Write-Host "  - $($layer.name)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Opening map in browser..." -ForegroundColor Yellow
    Start-Process $mapResult.url
    Write-Host ""
    Write-Host "The map should now be open in your browser!" -ForegroundColor Green
    Write-Host "Use the layer control (top-right) to switch between layers." -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "=== FAILED ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($mapResult.error)" -ForegroundColor Red
    Write-Host "Message: $($mapResult.message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Full response:" -ForegroundColor Yellow
    $mapResult | ConvertTo-Json -Depth 10
}

Write-Host ""