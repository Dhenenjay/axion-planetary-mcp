# Final test after server restart
Write-Host "=== Testing Earth Engine Map with Fixed Tile URLs ===" -ForegroundColor Green

# Step 1: Create composite
Write-Host "`n1. Creating composite..." -ForegroundColor Yellow
$compositeBody = '{"method":"tools/call","params":{"arguments":{"operation":"composite","region":"Los Angeles","startDate":"2024-01-01","endDate":"2024-03-31","satellite":"Sentinel-2","cloudCover":20,"compositeName":"LA_Sentinel2_2024"},"name":"earth_engine_process"},"id":1,"jsonrpc":"2.0"}'

$compositeResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
$compositeResult = $compositeResponse.Content | ConvertFrom-Json

if ($compositeResult.result) {
    Write-Host "   [OK] Composite created" -ForegroundColor Green
    
    # Step 2: Create map with multiple layers
    Write-Host "`n2. Creating interactive map with multiple layers..." -ForegroundColor Yellow
    $mapBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_map"
            arguments = @{
                operation = "create"
                input = "LA_Sentinel2_2024"
                region = "Los Angeles"
                layers = @(
                    @{
                        name = "True Color (RGB)"
                        bands = @("B4", "B3", "B2")
                        visParams = @{
                            min = 0
                            max = 3000
                        }
                    }
                    @{
                        name = "False Color (NIR)"
                        bands = @("B8", "B4", "B3")
                        visParams = @{
                            min = 0
                            max = 4000
                        }
                    }
                    @{
                        name = "SWIR Composite"
                        bands = @("B11", "B8", "B4")
                        visParams = @{
                            min = 0
                            max = 3500
                        }
                    }
                )
                basemap = "dark"
                zoom = 10
            }
        }
        id = 2
    } | ConvertTo-Json -Depth 10 -Compress
    
    $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
    $mapResult = $mapResponse.Content | ConvertFrom-Json
    
    if ($mapResult.result) {
        $mapData = $mapResult.result | ConvertFrom-Json
        Write-Host "   [OK] Map created" -ForegroundColor Green
        
        # Step 3: Verify API endpoint
        Write-Host "`n3. Verifying API endpoint..." -ForegroundColor Yellow
        $apiResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/map/$($mapData.mapId)" -UseBasicParsing
        $apiData = $apiResponse.Content | ConvertFrom-Json
        Write-Host "   [OK] API working" -ForegroundColor Green
        
        # Step 4: Display results
        Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
        Write-Host "`nMap Details:" -ForegroundColor Cyan
        Write-Host "  Region: $($apiData.region)"
        Write-Host "  Layers: $($apiData.layers.Count)"
        Write-Host "  Base map: $($apiData.metadata.basemap)"
        
        Write-Host "`nLayer Tile URLs (Fixed):" -ForegroundColor Cyan
        foreach ($layer in $apiData.layers) {
            Write-Host "  $($layer.name):"
            # Check if URL has duplicate path
            if ($layer.tileUrl -match "projects/earthengine-legacy/maps/projects/") {
            Write-Host "    [X] DUPLICATE PATH DETECTED" -ForegroundColor Red
            } else {
                Write-Host "    [OK] URL looks correct" -ForegroundColor Green
            }
            Write-Host "    $($layer.tileUrl.Substring(0, [Math]::Min(100, $layer.tileUrl.Length)))..." -ForegroundColor Gray
        }
        
        Write-Host "`nOPEN THIS URL IN YOUR BROWSER:" -ForegroundColor Yellow -BackgroundColor DarkGreen
        Write-Host $mapData.url -ForegroundColor Cyan
        Write-Host "`nThe Earth Engine layers should now be visible!" -ForegroundColor Green
        Write-Host "Use the layer control in the top-right to toggle between True Color, False Color, and SWIR views." -ForegroundColor Yellow
        
    } else {
        Write-Host "   [X] Map creation failed" -ForegroundColor Red
        Write-Host $mapResult | ConvertTo-Json -Depth 10
    }
} else {
    Write-Host "   [X] Composite creation failed" -ForegroundColor Red
    Write-Host $compositeResult | ConvertTo-Json -Depth 10
}