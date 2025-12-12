# Simple map test - create with single visualization

Write-Host "Creating simple map..." -ForegroundColor Yellow

$mapBody = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_map"
        arguments = @{
            operation = "create"
            input = "LA_Sentinel2_2024"
            region = "Los Angeles"
            bands = @("B4", "B3", "B2")
            visParams = @{
                min = 0
                max = 3000
            }
            basemap = "dark"
            zoom = 10
        }
    }
    id = 1
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Request body:" -ForegroundColor Gray
Write-Host $mapBody

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $mapBody -ContentType "application/json" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.result) {
        Write-Host "`nMap created successfully!" -ForegroundColor Green
        $mapData = $result.result | ConvertFrom-Json
        Write-Host "Map ID: $($mapData.mapId)" -ForegroundColor Cyan
        Write-Host "URL: $($mapData.url)" -ForegroundColor Cyan
        
        # Test API
        Write-Host "`nTesting API..." -ForegroundColor Yellow
        $apiResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/map/$($mapData.mapId)" -UseBasicParsing
        $apiData = $apiResponse.Content | ConvertFrom-Json
        Write-Host "API Success! Tile URL:" -ForegroundColor Green
        Write-Host $apiData.tileUrl -ForegroundColor Gray
    } else {
        Write-Host "Creation failed!" -ForegroundColor Red
        Write-Host ($result | ConvertTo-Json -Depth 10)
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response -ForegroundColor Red
}