# Test Dataset Info Functionality
$ErrorActionPreference = "Continue"
$SSE_ENDPOINT = "http://localhost:3000/api/mcp/sse"

Write-Host ""
Write-Host "TESTING DATASET INFO FUNCTIONALITY" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

function Test-DatasetInfo {
    param(
        [string]$DatasetId,
        [string]$TestName
    )
    
    Write-Host "TEST: $TestName" -ForegroundColor Yellow
    Write-Host "  Dataset ID: $DatasetId" -ForegroundColor Gray
    
    $body = @{
        tool = "earth_engine_data"
        arguments = @{
            operation = "info"
            datasetId = $DatasetId
        }
    } | ConvertTo-Json -Depth 10
    
    Write-Host "  Request Body:" -ForegroundColor DarkGray
    Write-Host "  $body" -ForegroundColor DarkGray
    
    try {
        $response = Invoke-RestMethod -Uri $SSE_ENDPOINT `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 30
        
        if ($response.error) {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            return $false
        }
        
        Write-Host "  SUCCESS" -ForegroundColor Green
        
        # Show dataset info
        if ($response.title) {
            Write-Host "  Title: $($response.title)" -ForegroundColor Cyan
        }
        if ($response.description) {
            $desc = if ($response.description.Length -gt 100) { 
                $response.description.Substring(0, 100) + "..." 
            } else { 
                $response.description 
            }
            Write-Host "  Description: $desc" -ForegroundColor Cyan
        }
        if ($response.bands) {
            Write-Host "  Bands: $($response.bands -join ', ')" -ForegroundColor Cyan
        }
        if ($response.properties) {
            Write-Host "  Properties available: Yes" -ForegroundColor Cyan
        }
        
        return $true
    }
    catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test various datasets
Write-Host ""
$test1 = Test-DatasetInfo -DatasetId "COPERNICUS/S2_SR_HARMONIZED" -TestName "Sentinel-2 Surface Reflectance"

Write-Host ""
$test2 = Test-DatasetInfo -DatasetId "MODIS/006/MOD13Q1" -TestName "MODIS Vegetation Indices"

Write-Host ""
$test3 = Test-DatasetInfo -DatasetId "LANDSAT/LC08/C02/T1_L2" -TestName "Landsat 8 Collection 2"

Write-Host ""
$test4 = Test-DatasetInfo -DatasetId "NASA/GPM_L3/IMERG_V06" -TestName "GPM Precipitation"

# Summary
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor White
Write-Host "===================================" -ForegroundColor Cyan

$tests = @($test1, $test2, $test3, $test4)
$passed = ($tests | Where-Object { $_ -eq $true }).Count
$failed = ($tests | Where-Object { $_ -eq $false }).Count

Write-Host "Total Tests: $($tests.Count)" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($failed -gt 0) {
    Write-Host ""
    Write-Host "Dataset INFO operation needs fixing!" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "Dataset INFO operation is working!" -ForegroundColor Green
}
