#!/usr/bin/env pwsh
# International Earth Engine MCP Server Test
# Tests both US and international locations

$baseUrl = "http://localhost:3000"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   EARTH ENGINE MCP - INTERNATIONAL TEST       " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Test cities from around the world
$testCities = @(
    @{Name="Los Angeles"; Country="USA"; Expected="Success"},
    @{Name="New York"; Country="USA"; Expected="Success"},
    @{Name="San Francisco"; Country="USA"; Expected="Success"},
    @{Name="Chicago"; Country="USA"; Expected="Success"},
    @{Name="Miami"; Country="USA"; Expected="Success"},
    @{Name="Ludhiana"; Country="India"; Expected="Success"},
    @{Name="Mumbai"; Country="India"; Expected="Success"},
    @{Name="Delhi"; Country="India"; Expected="Success"},
    @{Name="Bangalore"; Country="India"; Expected="Success"},
    @{Name="London"; Country="UK"; Expected="Success"},
    @{Name="Paris"; Country="France"; Expected="Success"},
    @{Name="Tokyo"; Country="Japan"; Expected="Success"},
    @{Name="Sydney"; Country="Australia"; Expected="Success"},
    @{Name="Toronto"; Country="Canada"; Expected="Success"},
    @{Name="Dubai"; Country="UAE"; Expected="Success"}
)

$passed = 0
$failed = 0

Write-Host "Testing thumbnail generation for cities worldwide..." -ForegroundColor Yellow
Write-Host ""

foreach ($city in $testCities) {
    Write-Host -NoNewline "Testing $($city.Name) ($($city.Country))... "
    
    $body = @{
        tool = "get_thumbnail_image"
        arguments = @{
            datasetId = "COPERNICUS/S2_SR"
            start = "2024-01-01"
            end = "2024-01-31"
            aoi = $city.Name
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/mcp/sse" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        $data = $response.content.text | ConvertFrom-Json
        
        if ($data.url) {
            Write-Host "[PASS]" -ForegroundColor Green -NoNewline
            Write-Host " $($data.width)x$($data.height)px" -ForegroundColor Gray
            $passed++
        } else {
            Write-Host "[FAIL]" -ForegroundColor Red -NoNewline
            Write-Host " No URL returned" -ForegroundColor Gray
            $failed++
        }
    } catch {
        Write-Host "[FAIL]" -ForegroundColor Red -NoNewline
        Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Gray
        $failed++
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "                TEST RESULTS                   " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Passed: $passed/$($testCities.Count)" -ForegroundColor $(if ($passed -eq $testCities.Count) { "Green" } else { "Yellow" })
Write-Host "Failed: $failed/$($testCities.Count)" -ForegroundColor $(if ($failed -eq 0) { "Gray" } else { "Red" })
Write-Host ""

if ($passed -eq $testCities.Count) {
    Write-Host "SUCCESS: All international locations are working!" -ForegroundColor Green
    Write-Host "The Earth Engine MCP Server supports global coverage." -ForegroundColor Green
} elseif ($passed -gt 0) {
    Write-Host "PARTIAL SUCCESS: Some locations are working." -ForegroundColor Yellow
    Write-Host "Check the FAO GAUL dataset names for failed locations." -ForegroundColor Yellow
} else {
    Write-Host "FAILURE: No locations are working." -ForegroundColor Red
    Write-Host "Check the server logs for errors." -ForegroundColor Red
}

Write-Host ""
Write-Host "Server endpoint: $baseUrl" -ForegroundColor Gray
