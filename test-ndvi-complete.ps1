# Complete NDVI Visualization Test
Write-Host "=== Complete NDVI Visualization Test ===" -ForegroundColor Green

# Step 1: Create a fresh composite
Write-Host "`n1. Creating new Sentinel-2 composite..." -ForegroundColor Yellow
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

$compositeResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
$compositeResult = $compositeResponse.Content | ConvertFrom-Json

if ($compositeResult.result.success) {
    $compositeKey = $compositeResult.result.compositeKey
    Write-Host "  [OK] Composite created: $compositeKey" -ForegroundColor Green
    
    # Step 2: Calculate NDVI using the correct parameters
    Write-Host "`n2. Calculating NDVI index..." -ForegroundColor Yellow
    $ndviBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_process"
            arguments = @{
                operation = "index"
                input = $compositeKey  # Use 'input' instead of 'compositeKey'
                indexType = "NDVI"
            }
        }
        id = 2
    } | ConvertTo-Json -Depth 10 -Compress
    
    $ndviResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $ndviBody -ContentType "application/json" -UseBasicParsing
    $ndviResult = $ndviResponse.Content | ConvertFrom-Json
    
    if ($ndviResult.result.success) {
        $ndviKey = $ndviResult.result.indexKey
        Write-Host "  [OK] NDVI calculated: $ndviKey" -ForegroundColor Green
        
        # Step 3: Create comprehensive visualization map
        Write-Host "`n3. Creating comprehensive visualization map..." -ForegroundColor Yellow
        $mapBody = @{
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
                            name = "True Color (Natural)"
                            bands = @("B4", "B3", "B2")
                            visParams = @{
                                min = 0
                                max = 0.3
                                gamma = 1.4
                            }
                        }
                        @{
                            name = "Enhanced True Color"
                            bands = @("B4", "B3", "B2")
                            visParams = @{
                                min = 0.05
                                max = 0.25
                                gamma = 1.2
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
                            name = "Agriculture (B8-B11-B2)"
                            bands = @("B8", "B11", "B2")
                            visParams = @{
                                min = 0
                                max = 0.4
                                gamma = 1.3
                            }
                        }
                        @{
                            name = "Urban/SWIR (B12-B11-B4)"
                            bands = @("B12", "B11", "B4")
                            visParams = @{
                                min = 0
                                max = 0.4
                                gamma = 1.5
                            }
                        }
                    )
                    basemap = "satellite"
                    zoom = 10
                }
            }
            id = 3
        } | ConvertTo-Json -Depth 10 -Compress
        
        $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
        $mapResult = $mapResponse.Content | ConvertFrom-Json
        
        if ($mapResult.result.success) {
            $mapData = $mapResult.result
            Write-Host "  [OK] Map created successfully!" -ForegroundColor Green
            
            # Also create a dedicated NDVI visualization map
            Write-Host "`n4. Creating dedicated NDVI map..." -ForegroundColor Yellow
            $ndviMapBody = @{
                jsonrpc = "2.0"
                method = "tools/call"
                params = @{
                    name = "earth_engine_map"
                    arguments = @{
                        operation = "create"
                        input = $ndviKey  # Use the NDVI result
                        region = "Los Angeles"
                        bands = @("NDVI")
                        visParams = @{
                            min = -0.2
                            max = 0.8
                            palette = @("red", "yellow", "lightgreen", "green", "darkgreen")
                        }
                        basemap = "satellite"
                        zoom = 10
                    }
                }
                id = 4
            } | ConvertTo-Json -Depth 10 -Compress
            
            $ndviMapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $ndviMapBody -ContentType "application/json" -UseBasicParsing
            $ndviMapResult = $ndviMapResponse.Content | ConvertFrom-Json
            
            if ($ndviMapResult.result.success) {
                $ndviMapData = $ndviMapResult.result
                Write-Host "  [OK] NDVI map created!" -ForegroundColor Green
                
                Write-Host "`n==========================================" -ForegroundColor Yellow
                Write-Host "   SUCCESS - TWO MAPS CREATED:" -ForegroundColor White -BackgroundColor DarkGreen
                Write-Host "==========================================" -ForegroundColor Yellow
                
                Write-Host "`n1. MULTI-LAYER VISUALIZATION MAP:" -ForegroundColor Cyan
                Write-Host "   $($mapData.url)" -ForegroundColor Green
                Write-Host "   Layers available:" -ForegroundColor Gray
                Write-Host "   • True Color (Natural RGB)" -ForegroundColor Gray
                Write-Host "   • Enhanced True Color (Better contrast)" -ForegroundColor Gray
                Write-Host "   • False Color (Vegetation in red)" -ForegroundColor Gray
                Write-Host "   • Agriculture (Crop monitoring)" -ForegroundColor Gray
                Write-Host "   • Urban/SWIR (Built areas)" -ForegroundColor Gray
                
                Write-Host "`n2. DEDICATED NDVI MAP:" -ForegroundColor Cyan
                Write-Host "   $($ndviMapData.url)" -ForegroundColor Green
                Write-Host "   Color scheme:" -ForegroundColor Gray
                Write-Host "   • Dark green = Healthy vegetation" -ForegroundColor DarkGreen
                Write-Host "   • Light green = Moderate vegetation" -ForegroundColor Green
                Write-Host "   • Yellow = Sparse vegetation" -ForegroundColor Yellow
                Write-Host "   • Red = No vegetation/Urban" -ForegroundColor Red
                
                Write-Host "`n==========================================" -ForegroundColor Yellow
                Write-Host "Open these URLs in your browser to explore!" -ForegroundColor White
            } else {
                Write-Host "  [X] NDVI map failed" -ForegroundColor Red
            }
        } else {
            Write-Host "  [X] Map creation failed" -ForegroundColor Red
        }
    } else {
        Write-Host "  [X] NDVI calculation failed" -ForegroundColor Red
        Write-Host ($ndviResult | ConvertTo-Json -Depth 5)
    }
} else {
    Write-Host "  [X] Composite creation failed" -ForegroundColor Red
    Write-Host ($compositeResult | ConvertTo-Json -Depth 5)
}