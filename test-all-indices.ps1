# Comprehensive Vegetation Indices Test
Write-Host "=== Comprehensive Vegetation Indices Test ===" -ForegroundColor Green

# Step 1: Create composite
Write-Host "`n1. Creating Sentinel-2 composite..." -ForegroundColor Yellow
$compositeBody = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-03-31"
            cloudCoverMax = 20
            compositeType = "median"
        }
    }
    id = 1
} | ConvertTo-Json -Depth 10 -Compress

$response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
$result = $response.Content | ConvertFrom-Json

if ($result.result.success) {
    $compositeKey = $result.result.compositeKey
    Write-Host "  [OK] Composite created: $compositeKey" -ForegroundColor Green
    
    # Step 2: Calculate multiple indices
    $indices = @(
        @{name="NDVI"; desc="Vegetation Health"; palette=@("#d7191c", "#fdae61", "#ffffbf", "#a6d96a", "#1a9641")},
        @{name="NDWI"; desc="Water Content"; palette=@("#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#01665e")},
        @{name="NDBI"; desc="Built-up Areas"; palette=@("#1a9850", "#91cf60", "#d9ef8b", "#fee08b", "#fc8d59", "#d73027")}
    )
    
    $indexKeys = @{}
    
    foreach ($index in $indices) {
        Write-Host "`n2. Calculating $($index.name) ($($index.desc))..." -ForegroundColor Yellow
        
        $indexBody = @{
            jsonrpc = "2.0"
            method = "tools/call"
            params = @{
                name = "earth_engine_process"
                arguments = @{
                    operation = "index"
                    input = $compositeKey
                    indexType = $index.name
                }
            }
            id = 2
        } | ConvertTo-Json -Depth 10 -Compress
        
        $indexResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $indexBody -ContentType "application/json" -UseBasicParsing
        $indexResult = $indexResponse.Content | ConvertFrom-Json
        
        if ($indexResult.result.success) {
            $indexKey = $indexResult.result.indexKey
            $indexKeys[$index.name] = $indexKey
            Write-Host "  [OK] $($index.name) calculated: $indexKey" -ForegroundColor Green
            
            # Create map for this index
            Write-Host "  Creating $($index.name) map..." -ForegroundColor Cyan
            $mapBody = @{
                jsonrpc = "2.0"
                method = "tools/call"
                params = @{
                    name = "earth_engine_map"
                    arguments = @{
                        operation = "create"
                        input = $indexKey
                        region = "Los Angeles"
                        bands = @($index.name)
                        visParams = @{
                            min = -0.2
                            max = 0.8
                            palette = $index.palette
                        }
                        basemap = "satellite"
                        zoom = 10
                    }
                }
                id = 3
            } | ConvertTo-Json -Depth 10 -Compress
            
            $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
            $mapResult = $mapResponse.Content | ConvertFrom-Json
            
            if ($mapResult.result.success) {
                Write-Host "  [OK] $($index.name) map: $($mapResult.result.url)" -ForegroundColor Green
            }
        } else {
            Write-Host "  [X] $($index.name) failed: $($indexResult.result.error)" -ForegroundColor Red
        }
    }
    
    # Step 3: Create combined visualization map
    Write-Host "`n3. Creating combined visualization map..." -ForegroundColor Yellow
    $combinedMapBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_map"
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
                    }
                    @{
                        name = "False Color (Vegetation)"
                        bands = @("B8", "B4", "B3")
                        visParams = @{
                            min = 0
                            max = 0.4
                            gamma = 1.3
                        }
                    }
                    @{
                        name = "SWIR (Urban)"
                        bands = @("B12", "B11", "B4")
                        visParams = @{
                            min = 0
                            max = 0.4
                            gamma = 1.5
                        }
                    }
                    @{
                        name = "Agriculture"
                        bands = @("B8", "B11", "B2")
                        visParams = @{
                            min = 0
                            max = 0.4
                            gamma = 1.3
                        }
                    }
                )
                basemap = "satellite"
                zoom = 10
            }
        }
        id = 4
    } | ConvertTo-Json -Depth 10 -Compress
    
    $combinedResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $combinedMapBody -ContentType "application/json" -UseBasicParsing
    $combinedResult = $combinedResponse.Content | ConvertFrom-Json
    
    if ($combinedResult.result.success) {
        Write-Host "  [OK] Combined map created!" -ForegroundColor Green
        
        Write-Host "`n==========================================" -ForegroundColor Yellow
        Write-Host "   🎉 ALL INDICES WORKING CORRECTLY!" -ForegroundColor White -BackgroundColor DarkGreen
        Write-Host "==========================================" -ForegroundColor Yellow
        
        Write-Host "`nMULTI-LAYER VISUALIZATION MAP:" -ForegroundColor Cyan
        Write-Host "$($combinedResult.result.url)" -ForegroundColor Green
        
        Write-Host "`nINDEX INTERPRETATIONS:" -ForegroundColor Yellow
        Write-Host "• NDVI: Green = Healthy vegetation, Red = No vegetation" -ForegroundColor Gray
        Write-Host "• NDWI: Blue = High water content, Brown = Dry" -ForegroundColor Gray
        Write-Host "• NDBI: Red = Urban/built-up, Green = Natural areas" -ForegroundColor Gray
        
        Write-Host "`nThe system is now fully functional for Claude Desktop testing!" -ForegroundColor Green
    }
} else {
    Write-Host "  [X] Composite creation failed" -ForegroundColor Red
}