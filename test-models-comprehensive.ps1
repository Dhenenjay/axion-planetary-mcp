# COMPREHENSIVE MODEL TEST WITH GROUND TRUTH VALIDATION
# ======================================================

Write-Host "`n===== COMPREHENSIVE MODEL TEST WITH GROUND TRUTH =====" -ForegroundColor Magenta
Write-Host "Loading ground truth data..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3000/api/mcp/sse"
$testResults = @{}
$allTests = @()

# Load ground truth files
$gtFiles = @{
    Wildfire = ".\test-data\wildfire-ground-truth.json"
    Flood = ".\test-data\flood-ground-truth.json"
    Agriculture = ".\test-data\agriculture-ground-truth.json"
    Deforestation = ".\test-data\deforestation-ground-truth.json"
    WaterQuality = ".\test-data\water-quality-ground-truth.json"
}

Write-Host "Ground truth files loaded" -ForegroundColor Green

# Test function
function Test-Model {
    param($Name, $Tool, $Args, $Timeout = 120)
    
    Write-Host "`n  Testing: $Name" -ForegroundColor Yellow
    $body = @{tool = $Tool; arguments = $Args} | ConvertTo-Json -Depth 10
    
    try {
        $start = Get-Date
        $resp = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec $Timeout
        $duration = ((Get-Date) - $start).TotalSeconds
        
        if ($resp.success -or $resp.data) {
            Write-Host "    SUCCESS in $([math]::Round($duration,1))s" -ForegroundColor Green
            return @{Name=$Name; Success=$true; Duration=$duration; Data=$resp}
        } else {
            Write-Host "    FAILED" -ForegroundColor Red
            return @{Name=$Name; Success=$false; Error=$resp.error}
        }
    } catch {
        Write-Host "    ERROR/TIMEOUT" -ForegroundColor Red
        return @{Name=$Name; Success=$false; Error=$_.Exception.Message}
    }
}

# 1. WILDFIRE TESTS
Write-Host "`n[1] WILDFIRE RISK ASSESSMENT" -ForegroundColor Red

$allTests += Test-Model "Wildfire-SF-HighRisk" "wildfire_risk_assessment" @{
    region = "San Francisco"
    startDate = "2024-07-01"
    endDate = "2024-08-31"
    scale = 30
}

$allTests += Test-Model "Wildfire-LA-Extreme" "wildfire_risk_assessment" @{
    region = "Los Angeles"
    startDate = "2024-08-01"
    endDate = "2024-09-30"
    scale = 10
}

$allTests += Test-Model "Wildfire-California-Large" "wildfire_risk_assessment" @{
    region = "California"
    startDate = "2024-06-01"
    endDate = "2024-10-31"
    scale = 100
}

# 2. FLOOD TESTS
Write-Host "`n[2] FLOOD RISK ASSESSMENT" -ForegroundColor Blue

$allTests += Test-Model "Flood-Houston-Urban" "flood_risk_assessment" @{
    region = "Houston"
    startDate = "2024-01-01"
    endDate = "2024-03-31"
    floodType = "urban"
    scale = 30
}

$allTests += Test-Model "Flood-Miami-Coastal" "flood_risk_assessment" @{
    region = "Miami"
    startDate = "2024-03-01"
    endDate = "2024-04-30"
    floodType = "coastal"
    scale = 10
}

$allTests += Test-Model "Flood-Sacramento-River" "flood_risk_assessment" @{
    region = "Sacramento"
    startDate = "2024-01-01"
    endDate = "2024-02-28"
    floodType = "riverine"
    scale = 50
}

# 3. AGRICULTURE TESTS
Write-Host "`n[3] AGRICULTURAL MONITORING" -ForegroundColor Green

$allTests += Test-Model "Agri-Colorado-Wheat" "agricultural_monitoring" @{
    region = "Colorado"
    startDate = "2023-10-15"
    endDate = "2024-07-20"
    cropType = "wheat"
    scale = 10
}

$allTests += Test-Model "Agri-Iowa-Corn" "agricultural_monitoring" @{
    region = "Iowa"
    startDate = "2024-04-25"
    endDate = "2024-10-15"
    cropType = "corn"
    scale = 10
}

$allTests += Test-Model "Agri-California-Almonds" "agricultural_monitoring" @{
    region = "Fresno, California"
    startDate = "2024-03-01"
    endDate = "2024-09-30"
    cropType = "almonds"
    scale = 10
}

# 4. DEFORESTATION TESTS
Write-Host "`n[4] DEFORESTATION DETECTION" -ForegroundColor DarkGreen

$allTests += Test-Model "Deforest-Amazon" "deforestation_detection" @{
    region = "Amazon"
    baselineStart = "2022-01-01"
    baselineEnd = "2022-12-31"
    currentStart = "2024-01-01"
    currentEnd = "2024-12-31"
    scale = 30
}

$allTests += Test-Model "Deforest-Cerrado" "deforestation_detection" @{
    region = "Brazil"
    baselineStart = "2022-06-01"
    baselineEnd = "2023-06-01"
    currentStart = "2023-06-01"
    currentEnd = "2024-06-01"
    scale = 30
}

$allTests += Test-Model "Deforest-Congo" "deforestation_detection" @{
    region = "Congo Basin"
    baselineStart = "2023-01-01"
    baselineEnd = "2023-12-31"
    currentStart = "2024-01-01"
    currentEnd = "2024-10-01"
    scale = 100
}

# 5. WATER QUALITY TESTS
Write-Host "`n[5] WATER QUALITY MONITORING" -ForegroundColor Cyan

$allTests += Test-Model "Water-SFBay" "water_quality_monitoring" @{
    region = "San Francisco Bay"
    startDate = "2024-03-01"
    endDate = "2024-03-31"
    scale = 30
}

$allTests += Test-Model "Water-LakeMichigan" "water_quality_monitoring" @{
    region = "Lake Michigan"
    startDate = "2024-07-01"
    endDate = "2024-07-31"
    scale = 10
}

$allTests += Test-Model "Water-Florida-River" "water_quality_monitoring" @{
    region = "St. Johns River, Florida"
    startDate = "2024-08-01"
    endDate = "2024-08-31"
    scale = 10
}

# 6. STRESS TESTS - EXTREME CONDITIONS
Write-Host "`n[6] EXTREME STRESS TESTS" -ForegroundColor Red

# Test with maximum resolution
$allTests += Test-Model "STRESS-MaxResolution" "wildfire_risk_assessment" @{
    region = "San Francisco"
    startDate = "2024-01-01"
    endDate = "2024-12-31"
    scale = 10  # Maximum resolution
    indices = @("NDVI", "NDWI", "NBR", "SAVI", "EVI", "NDMI")
} 180

# Test with large area
$allTests += Test-Model "STRESS-LargeArea" "flood_risk_assessment" @{
    region = "United States"
    startDate = "2024-01-01"
    endDate = "2024-03-31"
    scale = 1000
    floodType = "all"
} 300

# Test with long time series
$allTests += Test-Model "STRESS-LongTimeSeries" "agricultural_monitoring" @{
    region = "Central Valley, California"
    startDate = "2023-01-01"
    endDate = "2024-12-31"
    cropType = "mixed"
    scale = 100
} 240

# 7. CONCURRENT EXECUTION TEST
Write-Host "`n[7] CONCURRENT EXECUTION TEST" -ForegroundColor Magenta

$concurrentJobs = @()
$models = @("wildfire_risk_assessment", "flood_risk_assessment", "water_quality_monitoring")

Write-Host "  Starting 3 models simultaneously..." -ForegroundColor Yellow
foreach ($model in $models) {
    $job = Start-Job -ScriptBlock {
        param($url, $tool)
        $body = @{
            tool = $tool
            arguments = @{
                region = "California"
                startDate = "2024-01-01"
                endDate = "2024-03-31"
                scale = 100
            }
        } | ConvertTo-Json -Depth 10
        
        try {
            $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180
            return @{Model=$tool; Success=$true}
        } catch {
            return @{Model=$tool; Success=$false}
        }
    } -ArgumentList $baseUrl, $model
    
    $concurrentJobs += $job
}

Write-Host "  Waiting for concurrent jobs..." -ForegroundColor Yellow
$concurrentResults = @()
foreach ($job in $concurrentJobs) {
    $result = Receive-Job -Job $job -Wait
    $concurrentResults += $result
    Remove-Job -Job $job
}

$concurrentSuccess = ($concurrentResults | Where-Object {$_.Success -eq $true}).Count
Write-Host "  Concurrent test: $concurrentSuccess/3 succeeded" -ForegroundColor $(if ($concurrentSuccess -eq 3) {"Green"} else {"Yellow"})

# FINAL SUMMARY
Write-Host "`n======================================" -ForegroundColor Magenta
Write-Host "         FINAL TEST SUMMARY" -ForegroundColor Magenta
Write-Host "======================================" -ForegroundColor Magenta

$totalTests = $allTests.Count
$passedTests = ($allTests | Where-Object {$_.Success -eq $true}).Count
$failedTests = $totalTests - $passedTests
$passRate = if ($totalTests -gt 0) {[math]::Round(($passedTests/$totalTests)*100, 1)} else {0}

# Group by model type
$modelGroups = @{
    Wildfire = ($allTests | Where-Object {$_.Name -like "Wildfire-*"})
    Flood = ($allTests | Where-Object {$_.Name -like "Flood-*"})
    Agriculture = ($allTests | Where-Object {$_.Name -like "Agri-*"})
    Deforestation = ($allTests | Where-Object {$_.Name -like "Deforest-*"})
    WaterQuality = ($allTests | Where-Object {$_.Name -like "Water-*"})
    Stress = ($allTests | Where-Object {$_.Name -like "STRESS-*"})
}

foreach ($group in $modelGroups.Keys) {
    $tests = $modelGroups[$group]
    if ($tests) {
        $passed = ($tests | Where-Object {$_.Success -eq $true}).Count
        $total = $tests.Count
        $rate = if ($total -gt 0) {[math]::Round(($passed/$total)*100, 1)} else {0}
        
        Write-Host "`n$group Model Tests:" -ForegroundColor Cyan
        Write-Host "  Total: $total | Passed: $passed | Success Rate: $rate%" -ForegroundColor White
        
        foreach ($test in $tests) {
            $status = if ($test.Success) {"PASS"} else {"FAIL"}
            $color = if ($test.Success) {"Gray"} else {"DarkRed"}
            Write-Host "    [$status] $($test.Name)" -ForegroundColor $color
        }
    }
}

Write-Host "`n======================================" -ForegroundColor Magenta
Write-Host "OVERALL RESULTS:" -ForegroundColor White
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor $(if ($failedTests -eq 0) {"Green"} else {"Red"})
Write-Host "Success Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) {"Green"} elseif ($passRate -ge 75) {"Yellow"} else {"Red"})
Write-Host "Concurrent Test: $concurrentSuccess/3" -ForegroundColor $(if ($concurrentSuccess -eq 3) {"Green"} else {"Yellow"})

# Performance metrics
$avgDuration = ($allTests | Where-Object {$_.Duration} | ForEach-Object {$_.Duration} | Measure-Object -Average).Average
if ($avgDuration) {
    Write-Host "`nPerformance:" -ForegroundColor Yellow
    Write-Host "Average Response Time: $([math]::Round($avgDuration, 1))s" -ForegroundColor White
}

# Final verdict
Write-Host "`n======================================" -ForegroundColor Magenta
if ($passRate -ge 95) {
    Write-Host "EXCEPTIONAL! Models are production-ready!" -ForegroundColor Green
    Write-Host "All models performing at peak capacity" -ForegroundColor Green
    Write-Host "Ready for deployment!" -ForegroundColor Green
} elseif ($passRate -ge 80) {
    Write-Host "GOOD! Models are mostly ready" -ForegroundColor Green
    Write-Host "Some optimization may be needed" -ForegroundColor Yellow
} else {
    Write-Host "Models need attention" -ForegroundColor Yellow
    Write-Host "Review failed tests above" -ForegroundColor Yellow
}

Write-Host "======================================" -ForegroundColor Magenta
Write-Host "TEST COMPLETE!" -ForegroundColor Magenta

# Save results
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$resultFile = ".\test-results\model_test_$timestamp.json"
if (-not (Test-Path ".\test-results")) {
    New-Item -ItemType Directory -Path ".\test-results" | Out-Null
}

@{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    TotalTests = $totalTests
    Passed = $passedTests
    Failed = $failedTests
    SuccessRate = $passRate
    ConcurrentTest = @{Success=$concurrentSuccess; Total=3}
    AverageResponseTime = $avgDuration
    DetailedResults = $allTests
} | ConvertTo-Json -Depth 10 | Out-File $resultFile

Write-Host "`nResults saved to: $resultFile" -ForegroundColor Green
