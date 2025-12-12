# Test Global Shapefile Support via SSE Endpoint

Write-Host "🌍 Testing Global Shapefile Support via SSE Endpoint" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Blue
Write-Host ""

$endpoint = "http://localhost:3000/api/mcp/sse"

# Test locations
$testLocations = @(
    @{Name="Paris"; Description="European capital city"},
    @{Name="Tokyo"; Description="Asian megacity"},
    @{Name="Mumbai"; Description="Indian metropolis"},
    @{Name="São Paulo"; Description="South American city"},
    @{Name="Cairo"; Description="African capital"},
    @{Name="Sydney"; Description="Australian city"},
    @{Name="London"; Description="UK capital"},
    @{Name="Berlin"; Description="German capital"},
    @{Name="Dubai"; Description="Middle Eastern city"},
    @{Name="Singapore"; Description="Asian city-state"},
    @{Name="Paris, France"; Description="City with country context"},
    @{Name="Tokyo, Japan"; Description="City with country context"}
)

Write-Host "Testing convert_place_to_shapefile_geometry tool:" -ForegroundColor Yellow
Write-Host ""

foreach ($location in $testLocations) {
    Write-Host "📍 Testing: $($location.Name) - $($location.Description)" -ForegroundColor Cyan
    
    $body = @{
        tool = "convert_place_to_shapefile_geometry"
        arguments = @{
            place_name = $location.Name
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        
        if ($response.content) {
            $result = $response.content[0].text | ConvertFrom-Json
            
            if ($result.success) {
                Write-Host "  ✅ SUCCESS" -ForegroundColor Green
                Write-Host "     Area: $($result.area_km2) km²" -ForegroundColor White
                Write-Host "     Dataset: $($result.dataset)" -ForegroundColor White
                Write-Host "     Level: $($result.level)" -ForegroundColor White
                if ($result.centroid) {
                    Write-Host "     Centroid: $([math]::Round($result.centroid.lat, 2))°N, $([math]::Round($result.centroid.lon, 2))°E" -ForegroundColor White
                }
            } else {
                Write-Host "  ❌ FAILED: $($result.error)" -ForegroundColor Red
            }
        } else {
            Write-Host "  ❌ No response content" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "=" * 50 -ForegroundColor Blue
Write-Host ""

# Test filtering with global location
Write-Host "Testing filter_collection_by_date_and_region with global location:" -ForegroundColor Yellow
Write-Host ""

$filterTest = @{
    tool = "filter_collection_by_date_and_region"
    arguments = @{
        collection_id = "COPERNICUS/S2_SR_HARMONIZED"
        start_date = "2024-01-01"
        end_date = "2024-01-31"
        region = "Paris"
        cloud_cover_max = 20
    }
} | ConvertTo-Json

try {
    Write-Host "📍 Filtering Sentinel-2 images for Paris (January 2024)..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $filterTest -ContentType "application/json" -ErrorAction Stop
    
    if ($response.content) {
        $result = $response.content[0].text | ConvertFrom-Json
        
        if ($result.success) {
            Write-Host "  ✅ SUCCESS" -ForegroundColor Green
            Write-Host "     Image count: $($result.count)" -ForegroundColor White
            if ($result.images -and $result.images.Count -gt 0) {
                Write-Host "     First image date: $($result.images[0].date)" -ForegroundColor White
                Write-Host "     Cloud cover: $($result.images[0].cloud_cover)%" -ForegroundColor White
            }
        } else {
            Write-Host "  ❌ FAILED: $($result.error)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Blue
Write-Host "✨ Test completed!" -ForegroundColor Green
