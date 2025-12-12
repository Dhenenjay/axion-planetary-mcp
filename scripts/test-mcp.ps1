# Simple MCP test script for consolidated tools

$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "=== Testing Consolidated Earth Engine MCP Tools ===" -ForegroundColor Green
Write-Host ""

# Test 1: earth_engine_data - search
Write-Host "Test 1: Search for datasets" -ForegroundColor Cyan
$body = @{
    method = "tools/call"
    params = @{
        name = "earth_engine_data"
        arguments = @{
            operation = "search"
            query = "Sentinel-2"
            maxResults = 3
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body
    if ($response.result) {
        Write-Host "  PASSED - Found datasets" -ForegroundColor Green
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: earth_engine_system - auth
Write-Host "Test 2: Check authentication" -ForegroundColor Cyan  
$body = @{
    method = "tools/call"
    params = @{
        name = "earth_engine_system"
        arguments = @{
            operation = "auth"
            checkType = "status"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body
    if ($response.result) {
        Write-Host "  PASSED - Auth checked" -ForegroundColor Green
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: earth_engine_process - NDVI
Write-Host "Test 3: Calculate NDVI" -ForegroundColor Cyan
$body = @{
    method = "tools/call"
    params = @{
        name = "earth_engine_process"
        arguments = @{
            operation = "index"
            indexType = "NDVI"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-122.4194, 37.7749)
            }
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body
    if ($response.result) {
        Write-Host "  PASSED - NDVI calculated" -ForegroundColor Green
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: earth_engine_export - thumbnail
Write-Host "Test 4: Generate thumbnail" -ForegroundColor Cyan
$body = @{
    method = "tools/call"
    params = @{
        name = "earth_engine_export"
        arguments = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            geometry = @{
                type = "Point"
                coordinates = @(-122.4194, 37.7749)
            }
            dimensions = "256x256"
            format = "png"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body
    if ($response.result) {
        Write-Host "  PASSED - Thumbnail generated" -ForegroundColor Green
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Yellow
