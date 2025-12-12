# Simple direct test for Earth Engine MCP Server
$baseUrl = "http://localhost:3000/stdio"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n=== RUNNING EARTH ENGINE MCP TESTS ===" -ForegroundColor Cyan
$passed = 0
$failed = 0

# Helper function for testing
function Test-Tool($name, $args, $description) {
    Write-Host "`n$description" -NoNewline
    $body = @{
        method = "tools/call"
        params = @{
            name = $name
            arguments = $args
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $r = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30
        if ($r.result -and (-not $r.result.error)) {
            Write-Host " - PASS" -ForegroundColor Green
            $global:passed++
            return $true
        } else {
            Write-Host " - FAIL" -ForegroundColor Red
            if ($r.result.error) { Write-Host "  Error: $($r.result.error)" -ForegroundColor Yellow }
            $global:failed++
            return $false
        }
    } catch {
        Write-Host " - ERROR: $_" -ForegroundColor Red
        $global:failed++
        return $false
    }
}

# Test each critical operation
Test-Tool "earth_engine_data" @{operation="search"; query="Sentinel-2"; limit=3} "1. Search datasets"
Test-Tool "earth_engine_data" @{operation="info"; datasetId="COPERNICUS/S2_SR_HARMONIZED"} "2. Get dataset info"
Test-Tool "earth_engine_data" @{operation="geometry"; placeName="San Francisco"} "3. Get geometry"
Test-Tool "earth_engine_data" @{operation="boundaries"} "4. List boundaries"

Test-Tool "earth_engine_process" @{operation="index"; indexType="NDVI"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "5. Calculate NDVI"
Test-Tool "earth_engine_process" @{operation="mask"; maskType="clouds"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "6. Cloud masking"
Test-Tool "earth_engine_process" @{operation="composite"; compositeType="median"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "7. Create composite"
Test-Tool "earth_engine_process" @{operation="terrain"; terrainType="slope"} "8. Terrain analysis"

Test-Tool "earth_engine_export" @{operation="thumbnail"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"; dimensions=256} "9. Generate thumbnail"
Test-Tool "earth_engine_export" @{operation="tiles"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; startDate="2024-06-01"; endDate="2024-06-30"} "10. Generate tiles"

Test-Tool "earth_engine_system" @{operation="auth"; checkType="status"} "11. Check auth"
Test-Tool "earth_engine_system" @{operation="info"; infoType="system"} "12. System info"

# Summary
$total = $passed + $failed
$rate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total: $total | Passed: $passed | Failed: $failed" -ForegroundColor White
Write-Host "Success Rate: $rate%" -ForegroundColor $(if ($rate -ge 80) {"Green"} elseif ($rate -ge 60) {"Yellow"} else {"Red"})

if ($rate -eq 100) {
    Write-Host "`n[SUCCESS] ALL TESTS PASSED! Server is ready!" -ForegroundColor Green
} elseif ($rate -ge 80) {
    Write-Host "`n[OK] Most operations working ($rate%)" -ForegroundColor Yellow
} else {
    Write-Host "`n[WARNING] Several operations failing ($rate%)" -ForegroundColor Red
}
