# Test map creation
$body = @{
    jsonrpc = "2.0"
    method = "tools/call"
    params = @{
        name = "earth_engine_map"
        arguments = @{
            action = "create"
            region = "Los Angeles"
            composite = "LA_Sentinel2_2024"
            visualizations = @(
                @{
                    name = "True Color"
                    bands = @("B4", "B3", "B2")
                    min = 0
                    max = 3000
                }
            )
            basemap = "dark"
            zoom = 10
        }
    }
    id = 1
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Creating map with body:" -ForegroundColor Yellow
Write-Host $body

$response = Invoke-WebRequest -Uri "http://localhost:3000/stdio" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
$result = $response.Content | ConvertFrom-Json

if ($result.result) {
    Write-Host "`nMap created successfully!" -ForegroundColor Green
    $mapData = $result.result | ConvertFrom-Json
    Write-Host "Map ID: $($mapData.mapId)" -ForegroundColor Cyan
    Write-Host "URL: $($mapData.url)" -ForegroundColor Cyan
    
    # Now test if we can fetch it via API
    Write-Host "`nTesting API fetch..." -ForegroundColor Yellow
    try {
        $apiResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/map/$($mapData.mapId)" -UseBasicParsing
        $apiData = $apiResponse.Content | ConvertFrom-Json
        Write-Host "API fetch successful!" -ForegroundColor Green
        Write-Host "Region: $($apiData.region)" -ForegroundColor Cyan
        Write-Host "Layers: $($apiData.layers.Count)" -ForegroundColor Cyan
        
        # Display tile URLs
        Write-Host "`nTile URLs:" -ForegroundColor Yellow
        foreach ($layer in $apiData.layers) {
            Write-Host "  $($layer.name): $($layer.tileUrl)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "API fetch failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Map creation failed!" -ForegroundColor Red
    Write-Host $result | ConvertTo-Json -Depth 10
}