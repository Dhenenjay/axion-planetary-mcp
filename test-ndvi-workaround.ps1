# NDVI Visualization Workaround
# Instead of storing and retrieving composites, we'll calculate NDVI directly from dataset

Write-Host "=== NDVI Visualization (Direct Calculation) ===" -ForegroundColor Green

Write-Host "`nCalculating NDVI directly from Sentinel-2 data..." -ForegroundColor Yellow

# Calculate NDVI directly by providing dataset parameters
$ndviBody = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_process"
        arguments = @{
            operation = "index"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"  # Provide dataset directly
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-03-31"
            indexType = "NDVI"
        }
    }
    id = 1
} | ConvertTo-Json -Depth 10 -Compress

$ndviResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $ndviBody -ContentType "application/json" -UseBasicParsing
$ndviResult = $ndviResponse.Content | ConvertFrom-Json

if ($ndviResult.result.success) {
    $ndviKey = $ndviResult.result.indexKey
    Write-Host "  [OK] NDVI calculated: $ndviKey" -ForegroundColor Green
    
    # Create NDVI map
    Write-Host "`nCreating NDVI visualization map..." -ForegroundColor Yellow
    $mapBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_map"
            arguments = @{
                operation = "create"
                input = $ndviKey
                region = "Los Angeles"
                bands = @("NDVI")
                visParams = @{
                    min = -0.1
                    max = 0.7
                    palette = @(
                        "#a50026", "#d73027", "#f46d43", "#fdae61",
                        "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63",
                        "#1a9850", "#006837"
                    )
                }
                basemap = "satellite"
                zoom = 10
            }
        }
        id = 2
    } | ConvertTo-Json -Depth 10 -Compress
    
    $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
    $mapResult = $mapResponse.Content | ConvertFrom-Json
    
    if ($mapResult.result.success) {
        $mapData = $mapResult.result
        
        Write-Host "  [OK] NDVI map created!" -ForegroundColor Green
        
        # Also create a multi-band comparison map
        Write-Host "`nCreating comparison map with RGB and NDVI..." -ForegroundColor Yellow
        
        # First create a regular composite for RGB
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
            id = 3
        } | ConvertTo-Json -Depth 10 -Compress
        
        $compositeResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
        $compositeResult = $compositeResponse.Content | ConvertFrom-Json
        
        if ($compositeResult.result.success) {
            $compositeKey = $compositeResult.result.compositeKey
            
            # Create comparison map
            $comparisonMapBody = @{
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
                                name = "True Color RGB"
                                bands = @("B4", "B3", "B2")
                                visParams = @{
                                    min = 0
                                    max = 0.3
                                    gamma = 1.4
                                }
                            }
                            @{
                                name = "Vegetation (False Color)"
                                bands = @("B8", "B4", "B3")
                                visParams = @{
                                    min = 0
                                    max = 0.4
                                    gamma = 1.3
                                }
                            }
                            @{
                                name = "Agriculture Analysis"
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
            
            $comparisonResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $comparisonBody -ContentType "application/json" -UseBasicParsing
            $comparisonResult = $comparisonResponse.Content | ConvertFrom-Json
            
            if ($comparisonResult.result.success) {
                $comparisonData = $comparisonResult.result
                
                Write-Host "  [OK] Comparison map created!" -ForegroundColor Green
                
                Write-Host "`n==========================================" -ForegroundColor Yellow
                Write-Host "   TWO MAPS CREATED SUCCESSFULLY:" -ForegroundColor White -BackgroundColor DarkGreen
                Write-Host "==========================================" -ForegroundColor Yellow
                
                Write-Host "`n1. NDVI VEGETATION HEALTH MAP:" -ForegroundColor Cyan
                Write-Host "   $($mapData.url)" -ForegroundColor Green
                Write-Host "   Color gradient from red (no vegetation) to dark green (dense vegetation)" -ForegroundColor Gray
                
                Write-Host "`n2. MULTI-LAYER COMPARISON MAP:" -ForegroundColor Cyan
                Write-Host "   $($comparisonData.url)" -ForegroundColor Green
                Write-Host "   Toggle between:" -ForegroundColor Gray
                Write-Host "   • True Color RGB - Natural view" -ForegroundColor Gray
                Write-Host "   • False Color - Vegetation in red" -ForegroundColor Gray
                Write-Host "   • Agriculture - Crop analysis" -ForegroundColor Gray
                
                Write-Host "`n==========================================" -ForegroundColor Yellow
                Write-Host "Open these URLs to explore Los Angeles vegetation!" -ForegroundColor White
            }
        }
    } else {
        Write-Host "  [X] Map creation failed" -ForegroundColor Red
    }
} else {
    Write-Host "  [X] NDVI calculation failed" -ForegroundColor Red
    Write-Host "Error: $($ndviResult.result.error)" -ForegroundColor Red
}