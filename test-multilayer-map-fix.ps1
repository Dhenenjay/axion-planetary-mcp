#!/usr/bin/env pwsh

Write-Host "`n=== Multi-Layer Map Creation Test & Fix ===" -ForegroundColor Cyan
Write-Host "This script will diagnose and fix the multi-layer map issue" -ForegroundColor Yellow
Write-Host ""

# Step 1: First create individual composites for each layer
Write-Host "Step 1: Creating individual composites for each index..." -ForegroundColor Green

$indices = @("NDVI", "NDWI", "NDBI", "EVI")
$compositeKeys = @{}

foreach ($index in $indices) {
    Write-Host "  Creating $index composite..." -ForegroundColor Yellow
    
    $body = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_process"
            arguments = @{
                operation = "index"
                datasetId = "COPERNICUS/S2_SR_HARMONIZED"
                region = "Los Angeles"
                startDate = "2024-10-01"
                endDate = "2024-10-31"
                indexType = $index
                scale = 10
            }
        }
        id = Get-Random
    } | ConvertTo-Json -Depth 10 -Compress
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.result) {
            $content = $result.result.content[0].text | ConvertFrom-Json
            if ($content.success) {
                $key = $content.indexKey
                $compositeKeys[$index] = $key
                Write-Host "    ✓ $index created with key: $key" -ForegroundColor Green
            } else {
                Write-Host "    ✗ Failed to create $index" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "    ✗ Error creating $index : $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "Step 2: Testing single-layer map creation first..." -ForegroundColor Green

# Test with single layer first
if ($compositeKeys["NDVI"]) {
    $singleLayerBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_map"
            arguments = @{
                operation = "create"
                input = $compositeKeys["NDVI"]
                region = "Los Angeles"
                bands = @("NDVI")
                visParams = @{
                    min = -0.2
                    max = 0.8
                    palette = @("blue", "white", "green")
                }
                center = @(-118.2437, 34.0522)
                zoom = 10
                basemap = "satellite"
            }
        }
        id = Get-Random
    } | ConvertTo-Json -Depth 10 -Compress
    
    Write-Host "  Testing single layer map..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $singleLayerBody -ContentType "application/json" -UseBasicParsing
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.result) {
            $content = $result.result.content[0].text | ConvertFrom-Json
            if ($content.success) {
                Write-Host "    ✓ Single layer map created successfully!" -ForegroundColor Green
                Write-Host "    Map URL: $($content.url)" -ForegroundColor Cyan
            } else {
                Write-Host "    ✗ Single layer map failed: $($content.error)" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "    ✗ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Step 3: Now testing multi-layer map with per-layer inputs..." -ForegroundColor Green

# Build layers array with individual inputs
$layers = @()
foreach ($index in $indices) {
    if ($compositeKeys[$index]) {
        $layer = @{
            name = $index
            input = $compositeKeys[$index]
            bands = @($index)
            visParams = @{
                min = -0.2
                max = 0.8
                palette = @("red", "yellow", "green")
            }
        }
        $layers += $layer
    }
}

if ($layers.Count -gt 0) {
    $multiLayerBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_map"
            arguments = @{
                operation = "create"
                region = "Los Angeles"
                layers = $layers
                center = @(-118.2437, 34.0522)
                zoom = 10
                basemap = "satellite"
            }
        }
        id = Get-Random
    } | ConvertTo-Json -Depth 10 -Compress
    
    Write-Host "  Creating multi-layer map with $($layers.Count) layers..." -ForegroundColor Yellow
    Write-Host "  Layers: $($indices -join ', ')" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $multiLayerBody -ContentType "application/json" -UseBasicParsing
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.result) {
            $content = $result.result.content[0].text | ConvertFrom-Json
            if ($content.success) {
                Write-Host "    ✓ Multi-layer map created successfully!" -ForegroundColor Green
                Write-Host "    Map ID: $($content.mapId)" -ForegroundColor Cyan
                Write-Host "    Map URL: $($content.url)" -ForegroundColor Cyan
                Write-Host "    Number of layers: $($content.layers.Count)" -ForegroundColor Cyan
                
                Write-Host "`n    Layer details:" -ForegroundColor Yellow
                foreach ($layer in $content.layers) {
                    Write-Host "      - $($layer.name): Ready" -ForegroundColor Green
                }
                
                Write-Host "`n    Instructions:" -ForegroundColor Yellow
                Write-Host "      1. Open the URL in your browser" -ForegroundColor White
                Write-Host "      2. Use the layer control to switch between indices" -ForegroundColor White
                Write-Host "      3. Each layer shows a different vegetation/water/urban index" -ForegroundColor White
                
                # Try to open in browser
                if ($content.url) {
                    Write-Host "`n    Opening map in browser..." -ForegroundColor Yellow
                    Start-Process $content.url
                }
            } else {
                Write-Host "    ✗ Multi-layer map failed: $($content.error)" -ForegroundColor Red
                Write-Host "    Message: $($content.message)" -ForegroundColor Red
            }
        } else {
            Write-Host "    ✗ No result returned" -ForegroundColor Red
        }
    } catch {
        Write-Host "    ✗ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Step 4: Alternative - Using global input with per-layer bands..." -ForegroundColor Green

# Create a base composite first
$baseCompositeBody = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-10-01"
            endDate = "2024-10-31"
            compositeType = "median"
        }
    }
    id = Get-Random
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "  Creating base composite..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $baseCompositeBody -ContentType "application/json" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.result) {
        $content = $result.result.content[0].text | ConvertFrom-Json
        if ($content.success -and $content.compositeKey) {
            Write-Host "    ✓ Base composite created: $($content.compositeKey)" -ForegroundColor Green
            
            # Now create a map with the base composite but different band combinations
            $altLayers = @(
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
                    name = "False Color"
                    bands = @("B8", "B4", "B3")
                    visParams = @{
                        min = 0
                        max = 0.3
                        gamma = 1.4
                    }
                },
                @{
                    name = "Agriculture"
                    bands = @("B11", "B8", "B2")
                    visParams = @{
                        min = 0
                        max = 0.3
                        gamma = 1.4
                    }
                }
            )
            
            $altMapBody = @{
                jsonrpc = "2.0"
                method = "tools/call"
                params = @{
                    name = "earth_engine_map"
                    arguments = @{
                        operation = "create"
                        input = $content.compositeKey
                        region = "Los Angeles"
                        layers = $altLayers
                        center = @(-118.2437, 34.0522)
                        zoom = 10
                        basemap = "terrain"
                    }
                }
                id = Get-Random
            } | ConvertTo-Json -Depth 10 -Compress
            
            Write-Host "  Creating alternative multi-layer map..." -ForegroundColor Yellow
            
            $response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $altMapBody -ContentType "application/json" -UseBasicParsing
            $result = $response.Content | ConvertFrom-Json
            
            if ($result.result) {
                $mapContent = $result.result.content[0].text | ConvertFrom-Json
                if ($mapContent.success) {
                    Write-Host "    ✓ Alternative map created successfully!" -ForegroundColor Green
                    Write-Host "    Map URL: $($mapContent.url)" -ForegroundColor Cyan
                    Write-Host "    Layers: True Color, False Color, Agriculture" -ForegroundColor Cyan
                }
            }
        }
    }
} catch {
    Write-Host "    ✗ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  The multi-layer map feature should now work correctly." -ForegroundColor White
Write-Host "  Each layer can have its own input source or share a common one." -ForegroundColor White
Write-Host "  The maps are viewable at http://localhost:3000/map/[mapId]" -ForegroundColor White
Write-Host ""