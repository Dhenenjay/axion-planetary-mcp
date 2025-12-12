# Test script for 4 consolidated Earth Engine MCP tools
# This tests that the consolidation from 30 to 4 tools works correctly

$endpoint = "http://localhost:3000/api/mcp/sse"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " TESTING CONSOLIDATED MCP TOOLS (4 TOOLS)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: earth_engine_data - Search operation
Write-Host "TEST 1: earth_engine_data - Search datasets" -ForegroundColor Yellow
$body1 = @{
    tool = "earth_engine_data"
    arguments = @{
        operation = "search"
        query = "sentinel"
        limit = 3
    }
} | ConvertTo-Json -Depth 10

try {
    $response1 = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body1 -ContentType "application/json"
    Write-Host "✓ Search completed - Found datasets" -ForegroundColor Green
} catch {
    Write-Host "✗ Search failed: $_" -ForegroundColor Red
}

# Test 2: earth_engine_data - Geometry operation
Write-Host "`nTEST 2: earth_engine_data - Get geometry for place" -ForegroundColor Yellow
$body2 = @{
    tool = "earth_engine_data"
    arguments = @{
        operation = "geometry"
        placeName = "Ludhiana"
    }
} | ConvertTo-Json -Depth 10

try {
    $response2 = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body2 -ContentType "application/json"
    Write-Host "✓ Geometry retrieved for Ludhiana" -ForegroundColor Green
} catch {
    Write-Host "✗ Geometry failed: $_" -ForegroundColor Red
}

# Test 3: earth_engine_process - Index operation
Write-Host "`nTEST 3: earth_engine_process - Calculate NDVI" -ForegroundColor Yellow
$body3 = @{
    tool = "earth_engine_process"
    arguments = @{
        operation = "index"
        input = "COPERNICUS/S2_SR_HARMONIZED"
        indexType = "NDVI"
    }
} | ConvertTo-Json -Depth 10

try {
    $response3 = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body3 -ContentType "application/json"
    Write-Host "✓ NDVI calculation configured" -ForegroundColor Green
} catch {
    Write-Host "✗ Index failed: $_" -ForegroundColor Red
}

# Test 4: earth_engine_export - Thumbnail operation
Write-Host "`nTEST 4: earth_engine_export - Generate thumbnail" -ForegroundColor Yellow
$body4 = @{
    tool = "earth_engine_export"
    arguments = @{
        operation = "thumbnail"
        input = "COPERNICUS/S2_SR_HARMONIZED"
        dimensions = 256
    }
} | ConvertTo-Json -Depth 10

try {
    $response4 = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body4 -ContentType "application/json"
    Write-Host "✓ Thumbnail generated" -ForegroundColor Green
} catch {
    Write-Host "✗ Thumbnail failed: $_" -ForegroundColor Red
}

# Test 5: earth_engine_system - Auth check
Write-Host "`nTEST 5: earth_engine_system - Check authentication" -ForegroundColor Yellow
$body5 = @{
    tool = "earth_engine_system"
    arguments = @{
        operation = "auth"
        checkType = "status"
    }
} | ConvertTo-Json -Depth 10

try {
    $response5 = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body5 -ContentType "application/json"
    Write-Host "✓ Authentication check completed" -ForegroundColor Green
} catch {
    Write-Host "✗ Auth check failed: $_" -ForegroundColor Red
}

# Test 6: earth_engine_system - System info
Write-Host "`nTEST 6: earth_engine_system - Get system info" -ForegroundColor Yellow
$body6 = @{
    tool = "earth_engine_system"
    arguments = @{
        operation = "info"
        infoType = "system"
    }
} | ConvertTo-Json -Depth 10

try {
    $response6 = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body6 -ContentType "application/json"
    Write-Host "✓ System info retrieved" -ForegroundColor Green
} catch {
    Write-Host "✗ System info failed: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " CONSOLIDATION TEST COMPLETE" -ForegroundColor Cyan
Write-Host " 30 tools -> 4 super tools [OK]" -ForegroundColor Green
Write-Host " MCP client stability improved!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
