# Test script to verify consolidated Earth Engine MCP tools
Write-Host "`n=== Testing Earth Engine Consolidated MCP Tools ===" -ForegroundColor Cyan
Write-Host "This script tests the 4 super tools that replace 30+ individual tools" -ForegroundColor Yellow

# Test endpoint
$apiUrl = "http://localhost:3000/api/mcp/consolidated"

# Function to test a tool
function Test-Tool {
    param(
        [string]$ToolName,
        [hashtable]$Arguments,
        [string]$Description
    )
    
    Write-Host "`n--- Testing: $Description ---" -ForegroundColor Green
    Write-Host "Tool: $ToolName" -ForegroundColor Yellow
    Write-Host "Arguments:" -ForegroundColor Yellow
    $Arguments | ConvertTo-Json -Depth 10 | Write-Host
    
    try {
        $body = @{
            tool = $ToolName
            arguments = $Arguments
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Method Post -Uri $apiUrl -Body $body -ContentType "application/json" -TimeoutSec 30
        
    Write-Host "SUCCESS!" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 10 | Write-Host
        return $true
    }
    catch {
        Write-Host "FAILED: $_" -ForegroundColor Red
        return $false
    }
}

# Keep track of results
$results = @()

# Test 1: Earth Engine Data - Search Catalog
$results += Test-Tool -ToolName "earth_engine_data" -Arguments @{
    operation = "search"
    query = "Sentinel-2"
} -Description "Search for Sentinel-2 in Earth Engine catalog"

Start-Sleep -Seconds 1

# Test 2: Earth Engine Data - Convert place to geometry
$results += Test-Tool -ToolName "earth_engine_data" -Arguments @{
    operation = "geometry"
    placeName = "San Francisco, CA"
} -Description "Convert San Francisco to geometry"

Start-Sleep -Seconds 1

# Test 3: Earth Engine Process - Calculate NDVI
$results += Test-Tool -ToolName "earth_engine_process" -Arguments @{
    operation = "index"
    index = "NDVI"
    collectionId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "San Francisco, CA"
} -Description "Calculate NDVI for San Francisco"

Start-Sleep -Seconds 1

# Test 4: Earth Engine Export - Get Thumbnail
$results += Test-Tool -ToolName "earth_engine_export" -Arguments @{
    operation = "thumbnail"
    collectionId = "COPERNICUS/S2_SR_HARMONIZED"
    startDate = "2024-01-01"
    endDate = "2024-01-31"
    region = "San Francisco, CA"
    bands = @("B4", "B3", "B2")
    min = @(0, 0, 0)
    max = @(3000, 3000, 3000)
} -Description "Get RGB thumbnail for San Francisco"

Start-Sleep -Seconds 1

# Test 5: Earth Engine System - Check Authentication
$results += Test-Tool -ToolName "earth_engine_system" -Arguments @{
    operation = "auth"
} -Description "Check Earth Engine authentication status"

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_ -eq $true }).Count
$failed = ($results | Where-Object { $_ -eq $false }).Count
$total = $results.Count

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($failed -eq 0) {
    Write-Host "`nAll tests passed! The consolidated tools are working correctly." -ForegroundColor Green
    Write-Host "`nNext Steps:" -ForegroundColor Yellow
    Write-Host "1. Restart Claude Desktop to load the new consolidated tools" -ForegroundColor White
    Write-Host "2. The tools will appear as:" -ForegroundColor White
    Write-Host "   - earth_engine_data (replaces 8 tools)" -ForegroundColor Gray
    Write-Host "   - earth_engine_process (replaces 10 tools)" -ForegroundColor Gray
    Write-Host "   - earth_engine_export (replaces 7 tools)" -ForegroundColor Gray
    Write-Host "   - earth_engine_system (replaces 5 tools)" -ForegroundColor Gray
    Write-Host "3. Use the 'operation' parameter to specify what you want to do" -ForegroundColor White
} else {
    Write-Host "`nSome tests failed. Please check the server logs." -ForegroundColor Yellow
}
