# Crop Classification Model Test with Ground Truth
Write-Host "=== Testing Crop Classification Model with Visualization ===" -ForegroundColor Green

# Step 1: Create a composite for agricultural area (e.g., Central Valley, California)
Write-Host "`n1. Creating agricultural composite for Central Valley..." -ForegroundColor Yellow
$compositeBody = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "Fresno, California"  # Agricultural area in Central Valley
            startDate = "2024-04-01"
            endDate = "2024-06-30"  # Growing season
            cloudCoverMax = 10
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
    
    # Step 2: Run agriculture model with classification
    Write-Host "`n2. Running agriculture model with crop classification..." -ForegroundColor Yellow
    
    # Define ground truth points (example crop locations)
    $groundTruth = @(
        @{lat = 36.7; lon = -119.7; cropType = "corn"; label = 1},
        @{lat = 36.75; lon = -119.75; cropType = "wheat"; label = 2},
        @{lat = 36.8; lon = -119.8; cropType = "cotton"; label = 3},
        @{lat = 36.65; lon = -119.65; cropType = "vineyard"; label = 4},
        @{lat = 36.85; lon = -119.85; cropType = "orchard"; label = 5}
    )
    
    $modelBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_process"
            arguments = @{
                operation = "model"
                modelType = "agriculture"
                input = $compositeKey
                region = "Fresno, California"
                cropType = "all"
                analysisType = "classification"
                classification = $true
                groundTruth = $groundTruth
                includeHistorical = $false
                yieldModel = $false
            }
        }
        id = 2
    } | ConvertTo-Json -Depth 10 -Compress
    
    Write-Host "  Sending model request..." -ForegroundColor Cyan
    $modelResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $modelBody -ContentType "application/json" -UseBasicParsing
    $modelResult = $modelResponse.Content | ConvertFrom-Json
    
    if ($modelResult.result.success) {
        $modelKey = $modelResult.result.modelKey
        Write-Host "  [OK] Agriculture model completed: $modelKey" -ForegroundColor Green
        Write-Host "  Model type: $($modelResult.result.modelType)" -ForegroundColor Cyan
        
        # Step 3: Generate thumbnail of the classification
        Write-Host "`n3. Generating thumbnail of crop classification..." -ForegroundColor Yellow
        $thumbnailBody = @{
            jsonrpc = "2.0"
            method = "tools/call"
            params = @{
                name = "earth_engine_export"
                arguments = @{
                    operation = "thumbnail"
                    input = $modelKey
                    region = "Fresno, California"
                    visParams = @{
                        bands = @("crop_health")
                        min = 0
                        max = 1
                        palette = @("#ff0000", "#ffff00", "#00ff00")
                    }
                    dimensions = 512
                }
            }
            id = 3
        } | ConvertTo-Json -Depth 10 -Compress
        
        $thumbnailResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $thumbnailBody -ContentType "application/json" -UseBasicParsing
        $thumbnailResult = $thumbnailResponse.Content | ConvertFrom-Json
        
        if ($thumbnailResult.result.success) {
            Write-Host "  [OK] Thumbnail generated!" -ForegroundColor Green
            Write-Host "  Thumbnail URL: $($thumbnailResult.result.url)" -ForegroundColor Cyan
        } else {
            Write-Host "  [X] Thumbnail failed: $($thumbnailResult.result.error)" -ForegroundColor Red
        }
        
        # Step 4: Create interactive map
        Write-Host "`n4. Creating interactive visualization map..." -ForegroundColor Yellow
        $mapBody = @{
            jsonrpc = "2.0"
            method = "tools/call"
            params = @{
                name = "earth_engine_map"
                arguments = @{
                    operation = "create"
                    input = $modelKey
                    region = "Fresno, California"
                    bands = @("crop_health")
                    visParams = @{
                        min = 0
                        max = 1
                        palette = @("#8b0000", "#ff4500", "#ffd700", "#90ee90", "#228b22")
                    }
                    basemap = "satellite"
                    zoom = 11
                }
            }
            id = 4
        } | ConvertTo-Json -Depth 10 -Compress
        
        $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
        $mapResult = $mapResponse.Content | ConvertFrom-Json
        
        if ($mapResult.result.success) {
            Write-Host "  [OK] Map created!" -ForegroundColor Green
            
            # Step 5: Also create multi-layer agricultural analysis map
            Write-Host "`n5. Creating comprehensive agricultural analysis map..." -ForegroundColor Yellow
            $multiMapBody = @{
                jsonrpc = "2.0"
                method = "tools/call"
                params = @{
                    name = "earth_engine_map"
                    arguments = @{
                        operation = "create"
                        input = $compositeKey
                        region = "Fresno, California"
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
                                name = "Agriculture (NIR-SWIR-Blue)"
                                bands = @("B8", "B11", "B2")
                                visParams = @{
                                    min = 0
                                    max = 0.4
                                    gamma = 1.3
                                }
                            }
                            @{
                                name = "Vegetation Health (False Color)"
                                bands = @("B8", "B4", "B3")
                                visParams = @{
                                    min = 0
                                    max = 0.4
                                    gamma = 1.3
                                }
                            }
                            @{
                                name = "Water Stress (SWIR)"
                                bands = @("B11", "B8", "B4")
                                visParams = @{
                                    min = 0
                                    max = 0.4
                                    gamma = 1.4
                                }
                            }
                        )
                        basemap = "satellite"
                        zoom = 11
                    }
                }
                id = 5
            } | ConvertTo-Json -Depth 10 -Compress
            
            $multiMapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $multiMapBody -ContentType "application/json" -UseBasicParsing
            $multiMapResult = $multiMapResponse.Content | ConvertFrom-Json
            
            if ($multiMapResult.result.success) {
                Write-Host "  [OK] Multi-layer map created!" -ForegroundColor Green
                
                Write-Host "`n==========================================" -ForegroundColor Yellow
                Write-Host "   🌾 CROP CLASSIFICATION SUCCESS!" -ForegroundColor White -BackgroundColor DarkGreen
                Write-Host "==========================================" -ForegroundColor Yellow
                
                Write-Host "`nRESULTS:" -ForegroundColor Cyan
                Write-Host "1. Model Key: $modelKey" -ForegroundColor Gray
                
                if ($thumbnailResult.result.success) {
                    Write-Host "2. Thumbnail URL: $($thumbnailResult.result.url)" -ForegroundColor Gray
                }
                
                Write-Host "3. Classification Map: $($mapResult.result.url)" -ForegroundColor Green
                Write-Host "4. Multi-layer Analysis: $($multiMapResult.result.url)" -ForegroundColor Green
                
                Write-Host "`nCROP HEALTH INTERPRETATION:" -ForegroundColor Yellow
                Write-Host "  🟥 Dark Red = Very poor health (0.0-0.2)" -ForegroundColor DarkRed
                Write-Host "  🟧 Orange = Poor health (0.2-0.4)" -ForegroundColor DarkYellow
                Write-Host "  🟨 Yellow = Fair health (0.4-0.6)" -ForegroundColor Yellow
                Write-Host "  🟩 Light Green = Good health (0.6-0.8)" -ForegroundColor Green
                Write-Host "  🟢 Dark Green = Excellent health (0.8-1.0)" -ForegroundColor DarkGreen
                
                Write-Host "`nGROUND TRUTH LABELS:" -ForegroundColor Yellow
                Write-Host "  1 = Corn" -ForegroundColor Gray
                Write-Host "  2 = Wheat" -ForegroundColor Gray
                Write-Host "  3 = Cotton" -ForegroundColor Gray
                Write-Host "  4 = Vineyard" -ForegroundColor Gray
                Write-Host "  5 = Orchard" -ForegroundColor Gray
                
                Write-Host "`nOpen the maps to explore agricultural patterns!" -ForegroundColor White
            }
        } else {
            Write-Host "  [X] Map creation failed: $($mapResult.result.error)" -ForegroundColor Red
        }
    } else {
        Write-Host "  [X] Agriculture model failed: $($modelResult.result.error)" -ForegroundColor Red
        Write-Host "  Full error:" -ForegroundColor Yellow
        Write-Host ($modelResult | ConvertTo-Json -Depth 5)
    }
} else {
    Write-Host "  [X] Composite creation failed" -ForegroundColor Red
}