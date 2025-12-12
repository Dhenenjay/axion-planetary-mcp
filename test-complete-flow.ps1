# Complete flow test: Create composite, then create map

Write-Host "=== STEP 1: Creating Composite ===" -ForegroundColor Green

$compositeBody = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_process"
        arguments = @{
            operation = "composite"
            region = "Los Angeles"
            startDate = "2024-01-01"
            endDate = "2024-03-31"
            satellite = "Sentinel-2"
            cloudCover = 20
            compositeName = "LA_Sentinel2_2024"
        }
    }
    id = 1
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Creating composite..." -ForegroundColor Yellow
$compositeResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $compositeBody -ContentType "application/json" -UseBasicParsing
$compositeResult = $compositeResponse.Content | ConvertFrom-Json

if ($compositeResult.result) {
    Write-Host "Composite created successfully!" -ForegroundColor Green
    Start-Sleep -Seconds 2
    
    Write-Host "`n=== STEP 2: Creating Map ===" -ForegroundColor Green
    
    $mapBody = @{
        jsonrpc = "2.0"
        method = "tools/call"
        params = @{
            name = "earth_engine_map"
            arguments = @{
                operation = "create"
                region = "Los Angeles"
                input = "LA_Sentinel2_2024"
                layers = @(
                    @{
                        name = "True Color"
                        bands = @("B4", "B3", "B2")
                        visParams = @{
                            min = 0
                            max = 3000
                        }
                    }
                    @{
                        name = "False Color"
                        bands = @("B8", "B4", "B3")
                        visParams = @{
                            min = 0
                            max = 3000
                        }
                    }
                )
                basemap = "dark"
                zoom = 10
            }
        }
        id = 2
    } | ConvertTo-Json -Depth 10 -Compress
    
    Write-Host "Creating interactive map..." -ForegroundColor Yellow
    $mapResponse = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
    $mapResult = $mapResponse.Content | ConvertFrom-Json
    
    if ($mapResult.result) {
        Write-Host "Map created successfully!" -ForegroundColor Green
        $mapData = $mapResult.result | ConvertFrom-Json
        Write-Host "`nMap Details:" -ForegroundColor Yellow
        Write-Host "  Map ID: $($mapData.mapId)" -ForegroundColor Cyan
        Write-Host "  URL: $($mapData.url)" -ForegroundColor Cyan
        
        # Test API endpoint
        Write-Host "`n=== STEP 3: Testing API Endpoint ===" -ForegroundColor Green
        Start-Sleep -Seconds 1
        
        try {
            $apiUrl = "http://localhost:3000/api/map/$($mapData.mapId)"
            Write-Host "Fetching from: $apiUrl" -ForegroundColor Yellow
            $apiResponse = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing
            $apiData = $apiResponse.Content | ConvertFrom-Json
            
            Write-Host "API fetch successful!" -ForegroundColor Green
            Write-Host "`nMap Session Data:" -ForegroundColor Yellow
            Write-Host "  Region: $($apiData.region)" -ForegroundColor Cyan
            Write-Host "  Layers: $($apiData.layers.Count)" -ForegroundColor Cyan
            Write-Host "  Created: $($apiData.created)" -ForegroundColor Cyan
            
            Write-Host "`nLayer Details:" -ForegroundColor Yellow
            foreach ($layer in $apiData.layers) {
                Write-Host "  - $($layer.name)" -ForegroundColor Cyan
                Write-Host "    Tile URL: $($layer.tileUrl.Substring(0, [Math]::Min(80, $layer.tileUrl.Length)))..." -ForegroundColor Gray
            }
            
            Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
            Write-Host "You can now open the map at: $($mapData.url)" -ForegroundColor Yellow
            Write-Host "The Earth Engine layers should be visible with the layer control in the top-right corner." -ForegroundColor Yellow
            
        } catch {
            Write-Host "API fetch failed!" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
        }
        
    } else {
        Write-Host "Map creation failed!" -ForegroundColor Red
        Write-Host $mapResult | ConvertTo-Json -Depth 10
    }
} else {
    Write-Host "Composite creation failed!" -ForegroundColor Red
    Write-Host $compositeResult | ConvertTo-Json -Depth 10
}