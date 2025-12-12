#!/usr/bin/env pwsh

Write-Host "`n=== Complete Multi-Layer Map Test ===" -ForegroundColor Cyan
Write-Host "This script will create a map with multiple layers" -ForegroundColor Yellow

# First, let's ensure the MCP server is running
Write-Host "`nStep 1: Checking MCP server..." -ForegroundColor Green

try {
    $testResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' -ContentType "application/json" -UseBasicParsing
    Write-Host "  [OK] MCP server is responding" -ForegroundColor Green
} catch {
    Write-Host "  X MCP server not responding. Please ensure it is running." -ForegroundColor Red
    exit 1
}

# Step 2: Create a composite
Write-Host "`nStep 2: Creating base composite..." -ForegroundColor Green

$compositeBody = @{
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

$compositeResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
$compositeResult = $compositeResponse.Content | ConvertFrom-Json

if ($compositeResult.result) {
    $compositeContent = $compositeResult.result.content[0].text | ConvertFrom-Json
    $compositeKey = $compositeContent.compositeKey
    Write-Host "  [OK] Composite created: $compositeKey" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Failed to create composite" -ForegroundColor Red
    exit 1
}

# Step 3: Create indices from the composite
Write-Host "`nStep 3: Creating vegetation indices..." -ForegroundColor Green

$indices = @("NDVI", "NDWI", "EVI", "NDBI")
$indexKeys = @{}

foreach ($index in $indices) {
    Write-Host "  Creating $index..." -ForegroundColor Yellow
    
    $indexBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_process"
            arguments = @{
                operation = "index"
                input = $compositeKey
                indexType = $index
                scale = 10
            }
        }
        id = Get-Random
    } | ConvertTo-Json -Depth 10 -Compress
    
    $indexResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $indexBody -ContentType "application/json" -UseBasicParsing
    $indexResult = $indexResponse.Content | ConvertFrom-Json
    
    if ($indexResult.result) {
        $indexContent = $indexResult.result.content[0].text | ConvertFrom-Json
        if ($indexContent.indexKey) {
            $indexKeys[$index] = $indexContent.indexKey
            Write-Host "    [OK] $index created: $($indexContent.indexKey)" -ForegroundColor Green
        }
    }
    
    Start-Sleep -Seconds 1
}

# Step 4: Create multi-layer map
Write-Host "`nStep 4: Creating multi-layer map..." -ForegroundColor Green

# Build layers array
$layers = @()

# Add True Color layer
$layers += @{
    name = "True Color"
    input = $compositeKey
    bands = @("B4", "B3", "B2")
    visParams = @{
        min = 0
        max = 0.3
        gamma = 1.4
    }
}

# Add False Color layer
$layers += @{
    name = "False Color"
    input = $compositeKey
    bands = @("B8", "B4", "B3")
    visParams = @{
        min = 0
        max = 0.3
        gamma = 1.4
    }
}

# Add index layers
foreach ($index in $indices) {
    if ($indexKeys[$index]) {
        $palette = switch ($index) {
            "NDVI" { @("blue", "white", "green") }
            "NDWI" { @("red", "yellow", "blue") }
            "EVI" { @("brown", "yellow", "green") }
            "NDBI" { @("green", "yellow", "red") }
        }
        
        $layers += @{
            name = $index
            input = $indexKeys[$index]
            bands = @($index)
            visParams = @{
                min = -0.2
                max = 0.8
                palette = $palette
            }
        }
    }
}

Write-Host "  Creating map with $($layers.Count) layers..." -ForegroundColor Yellow

$mapBody = @{
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

try {
    $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
    $mapResult = $mapResponse.Content | ConvertFrom-Json
    
    if ($mapResult.result) {
        $mapContent = $mapResult.result.content[0].text | ConvertFrom-Json
        if ($mapContent.success) {
            Write-Host "`n[SUCCESS] Multi-layer map created!" -ForegroundColor Green
            Write-Host "  Map ID: $($mapContent.mapId)" -ForegroundColor Cyan
            Write-Host "  Map URL: $($mapContent.url)" -ForegroundColor Cyan
            Write-Host "  Layers:" -ForegroundColor Yellow
            foreach ($layer in $mapContent.layers) {
                Write-Host "    - $($layer.name)" -ForegroundColor White
            }
            
            Write-Host "`n  Opening map in browser..." -ForegroundColor Yellow
            Start-Process $mapContent.url
            
            Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
            Write-Host "The multi-layer map has been created successfully!" -ForegroundColor Green
        } else {
            Write-Host "`n[FAIL] Map creation failed: $($mapContent.error)" -ForegroundColor Red
            Write-Host "  Message: $($mapContent.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "`n[FAIL] No result returned from map creation" -ForegroundColor Red
    }
} catch {
    Write-Host "`n[ERROR] Error creating map: $_" -ForegroundColor Red
}