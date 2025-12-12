# Clean Iowa Classification Test
Write-Host "Testing Fixed Classification System" -ForegroundColor Green

# Test 1: Agricultural Model
Write-Host "`n1. Testing Agricultural Model..." -ForegroundColor Yellow
$agResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
    tool = "earth_engine_process"
    arguments = @{
        operation = "model"
        modelType = "agriculture"
        region = "Iowa"
        startDate = "2024-06-01"
        endDate = "2024-09-30"
        scale = 30
    }
} | ConvertTo-Json)

if ($agResponse.modelKey) {
    Write-Host "Success! Model Key: $($agResponse.modelKey)" -ForegroundColor Green
    
    # Test thumbnail with model key
    Write-Host "Testing thumbnail generation..." -ForegroundColor Yellow
    $thumbTest = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
        tool = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            input = $agResponse.modelKey
            dimensions = 256
            region = "Iowa"
        }
    } | ConvertTo-Json)
    
    if ($thumbTest.url) {
        Write-Host "Thumbnail works! URL: $($thumbTest.url)" -ForegroundColor Green
    } else {
        Write-Host "Thumbnail failed" -ForegroundColor Red
    }
}

# Test 2: Wildfire Model
Write-Host "`n2. Testing Wildfire Model..." -ForegroundColor Yellow
$fireResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
    tool = "earth_engine_process"
    arguments = @{
        operation = "model"
        modelType = "wildfire"
        region = "California"
        startDate = "2024-06-01"
        endDate = "2024-09-30"
    }
} | ConvertTo-Json)

if ($fireResponse.modelKey) {
    Write-Host "Success! Model Key: $($fireResponse.modelKey)" -ForegroundColor Green
}

# Test 3: Water Quality Model
Write-Host "`n3. Testing Water Quality Model..." -ForegroundColor Yellow
$waterResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/consolidated" -Method Post -ContentType "application/json" -Body (@{
    tool = "earth_engine_process"
    arguments = @{
        operation = "model"
        modelType = "water_quality"
        region = "Lake Tahoe"
        startDate = "2024-06-01"
        endDate = "2024-08-31"
    }
} | ConvertTo-Json)

if ($waterResponse.modelKey) {
    Write-Host "Success! Model Key: $($waterResponse.modelKey)" -ForegroundColor Green
}

Write-Host "`nAll tests complete!" -ForegroundColor Green