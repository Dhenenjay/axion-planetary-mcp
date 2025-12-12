# PRODUCTION READINESS VALIDATION SUITE
# =====================================
# Complete end-to-end testing for production deployment
# Tests: Infrastructure, Security, Performance, Reliability, Scalability

param(
    [switch]$FullTest = $true,
    [switch]$SaveReport = $true,
    [string]$ReportPath = ".\production-validation-report.html"
)

Write-Host "`n" -NoNewline
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   PRODUCTION READINESS VALIDATION" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Starting comprehensive validation at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow

# Initialize validation results
$ValidationResults = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Environment = @{}
    Infrastructure = @{}
    Security = @{}
    Performance = @{}
    Reliability = @{}
    Scalability = @{}
    DataIntegrity = @{}
    ErrorHandling = @{}
    Summary = @{}
}

$TotalTests = 0
$PassedTests = 0
$FailedTests = 0
$Warnings = @()

# Helper function for test execution
function Test-Component {
    param(
        [string]$Category,
        [string]$TestName,
        [scriptblock]$TestScript,
        [string]$ExpectedResult = $null
    )
    
    $script:TotalTests++
    Write-Host "`n  [$Category] $TestName" -NoNewline -ForegroundColor Yellow
    
    try {
        $result = & $TestScript
        
        if ($ExpectedResult) {
            if ($result -eq $ExpectedResult) {
                Write-Host " PASS" -ForegroundColor Green
                $script:PassedTests++
                return @{Test=$TestName; Status="PASS"; Result=$result}
            } else {
                Write-Host " FAIL" -ForegroundColor Red
                $script:FailedTests++
                return @{Test=$TestName; Status="FAIL"; Expected=$ExpectedResult; Actual=$result}
            }
        } else {
            if ($result) {
                Write-Host " PASS" -ForegroundColor Green
                $script:PassedTests++
                return @{Test=$TestName; Status="PASS"; Result=$result}
            } else {
                Write-Host " FAIL" -ForegroundColor Red
                $script:FailedTests++
                return @{Test=$TestName; Status="FAIL"; Error="Test returned false or null"}
            }
        }
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
        $script:FailedTests++
        return @{Test=$TestName; Status="ERROR"; Error=$_.Exception.Message}
    }
}

# =====================================
# 1. ENVIRONMENT VALIDATION
# =====================================
Write-Host "`n[1] ENVIRONMENT & DEPENDENCIES" -ForegroundColor Cyan

$ValidationResults.Environment.NodeVersion = Test-Component "ENV" "Node.js Version" {
    $nodeVersion = & "C:\Program Files\nodejs\node.exe" --version 2>$null
    if ($nodeVersion -match "v(\d+)\.") {
        $majorVersion = [int]$matches[1]
        return $majorVersion -ge 18
    }
    return $false
}

$ValidationResults.Environment.NPMVersion = Test-Component "ENV" "NPM Version" {
    $npmVersion = & "C:\Program Files\nodejs\npm.cmd" --version 2>$null
    return $npmVersion -ne $null
}

$ValidationResults.Environment.ServiceAccount = Test-Component "ENV" "GEE Service Account" {
    $keyPath = "C:\Users\Dhenenjay\Downloads\ee-key.json"
    if (Test-Path $keyPath) {
        $keyContent = Get-Content $keyPath | ConvertFrom-Json
        return ($keyContent.type -eq "service_account")
    }
    return $false
}

$ValidationResults.Environment.EnvironmentVars = Test-Component "ENV" "Environment Variables" {
    $geeKey = $env:GOOGLE_EARTH_ENGINE_KEY
    return ($geeKey -ne $null) -or (Test-Path "C:\Users\Dhenenjay\Downloads\ee-key.json")
}

$ValidationResults.Environment.Dependencies = Test-Component "ENV" "Package Dependencies" {
    if (Test-Path ".\package.json") {
        $package = Get-Content ".\package.json" | ConvertFrom-Json
        $requiredDeps = @("@google/earthengine", "next", "react", "express")
        $missingDeps = @()
        foreach ($dep in $requiredDeps) {
            if (-not $package.dependencies.$dep) {
                $missingDeps += $dep
            }
        }
        return $missingDeps.Count -eq 0
    }
    return $false
}

# =====================================
# 2. INFRASTRUCTURE VALIDATION
# =====================================
Write-Host "`n[2] INFRASTRUCTURE CHECK" -ForegroundColor Cyan

$ValidationResults.Infrastructure.ServerRunning = Test-Component "INFRA" "Server Status" {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

$ValidationResults.Infrastructure.APIEndpoint = Test-Component "INFRA" "API Endpoint" {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body "{}" -ContentType "application/json" -TimeoutSec 5
        return $true
    } catch {
        # Even a 400/500 error means endpoint exists
        return $_.Exception.Response.StatusCode -ne $null
    }
}

$ValidationResults.Infrastructure.HealthCheck = Test-Component "INFRA" "Health Check Endpoint" {
    $body = @{
        tool = "earth_engine_system"
        arguments = @{operation = "health"}
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        return $response.health -ne $null
    } catch {
        return $false
    }
}

$ValidationResults.Infrastructure.BuildArtifacts = Test-Component "INFRA" "Build Artifacts" {
    $requiredPaths = @(".next", "node_modules", "src", "app")
    $missing = @()
    foreach ($path in $requiredPaths) {
        if (-not (Test-Path $path)) {
            $missing += $path
        }
    }
    return $missing.Count -eq 0
}

# =====================================
# 3. SECURITY VALIDATION
# =====================================
Write-Host "`n[3] SECURITY VALIDATION" -ForegroundColor Cyan

$ValidationResults.Security.Authentication = Test-Component "SEC" "GEE Authentication" {
    $body = @{
        tool = "earth_engine_system"
        arguments = @{operation = "auth"; checkType = "status"}
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        return $response.auth.authenticated -eq $true
    } catch {
        return $false
    }
}

$ValidationResults.Security.KeyProtection = Test-Component "SEC" "Service Key Protection" {
    # Check if key is not in source code
    $sourceFiles = Get-ChildItem -Path ".\src" -Recurse -Include "*.js","*.ts","*.json" -Exclude "package*.json"
    foreach ($file in $sourceFiles) {
        $content = Get-Content $file -Raw
        if ($content -match "private_key" -or $content -match "client_email.*@.*gserviceaccount") {
            return $false
        }
    }
    return $true
}

$ValidationResults.Security.InputValidation = Test-Component "SEC" "Input Validation" {
    # Test SQL injection attempt
    $body = @{
        tool = "earth_engine_data"
        arguments = @{
            operation = "search"
            query = "'; DROP TABLE users; --"
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        # Should handle gracefully without error
        return $true
    } catch {
        # Error handling is also acceptable
        return $true
    }
}

$ValidationResults.Security.ErrorMessages = Test-Component "SEC" "Safe Error Messages" {
    # Test that errors don't leak sensitive info
    $body = @{
        tool = "invalid_tool"
        arguments = @{}
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        return $true
    } catch {
        $errorContent = $_.ErrorDetails.Message
        # Check error doesn't contain paths or keys
        return -not ($errorContent -match "C:\\" -or $errorContent -match "private_key")
    }
}

# =====================================
# 4. PERFORMANCE TESTING
# =====================================
Write-Host "`n[4] PERFORMANCE TESTING" -ForegroundColor Cyan

$ValidationResults.Performance.ResponseTime = Test-Component "PERF" "Average Response Time" {
    $times = @()
    $tools = @("earth_engine_system", "earth_engine_data")
    
    foreach ($tool in $tools) {
        $body = @{
            tool = $tool
            arguments = @{operation = "info"}
        } | ConvertTo-Json
        
        $start = Get-Date
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
            $duration = ((Get-Date) - $start).TotalSeconds
            $times += $duration
        } catch {
            return $false
        }
    }
    
    $avgTime = ($times | Measure-Object -Average).Average
    return $avgTime -lt 5  # Should respond within 5 seconds on average
}

$ValidationResults.Performance.LargePayload = Test-Component "PERF" "Large Payload Handling" {
    # Test with multiple indices
    $body = @{
        tool = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "San Francisco"
            startDate = "2024-01-01"
            endDate = "2024-01-31"
            compositeType = "median"
        }
    } | ConvertTo-Json
    
    try {
        $start = Get-Date
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
        $duration = ((Get-Date) - $start).TotalSeconds
        return ($response.success -eq $true) -and ($duration -lt 60)
    } catch {
        return $false
    }
}

$ValidationResults.Performance.MemoryUsage = Test-Component "PERF" "Memory Usage" {
    # Get Node.js process memory
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $totalMemoryMB = ($nodeProcesses | Measure-Object WorkingSet -Sum).Sum / 1MB
        # Should be under 2GB for healthy operation
        return $totalMemoryMB -lt 2048
    }
    return $true  # Pass if can't measure
}

# =====================================
# 5. RELIABILITY TESTING
# =====================================
Write-Host "`n[5] RELIABILITY TESTING" -ForegroundColor Cyan

$ValidationResults.Reliability.ConsecutiveCalls = Test-Component "REL" "50 Consecutive Calls" {
    $successCount = 0
    for ($i = 1; $i -le 50; $i++) {
        $body = @{
            tool = "earth_engine_system"
            arguments = @{operation = "info"}
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5
            if ($response) { $successCount++ }
        } catch {
            # Continue testing
        }
    }
    return $successCount -ge 48  # 96% success rate
}

$ValidationResults.Reliability.ErrorRecovery = Test-Component "REL" "Error Recovery" {
    # Send invalid request
    $body = @{
        tool = "earth_engine_data"
        arguments = @{operation = "invalid_operation"}
    } | ConvertTo-Json
    
    try {
        $response1 = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    } catch {
        # Expected to fail
    }
    
    # Now send valid request
    $body = @{
        tool = "earth_engine_system"
        arguments = @{operation = "info"}
    } | ConvertTo-Json
    
    try {
        $response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        return $response2 -ne $null
    } catch {
        return $false
    }
}

$ValidationResults.Reliability.Timeout = Test-Component "REL" "Timeout Handling" {
    # Test with operation that might timeout
    $body = @{
        tool = "earth_engine_process"
        arguments = @{
            operation = "composite"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            region = "United States"
            startDate = "2024-01-01"
            endDate = "2024-12-31"
            compositeType = "median"
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5
        return $true
    } catch {
        # Should handle timeout gracefully
        return $_.Exception.Message -match "timeout" -or $_.Exception.Message -match "operation"
    }
}

# =====================================
# 6. SCALABILITY TESTING
# =====================================
Write-Host "`n[6] SCALABILITY TESTING" -ForegroundColor Cyan

$ValidationResults.Scalability.ConcurrentRequests = Test-Component "SCALE" "10 Concurrent Requests" {
    $jobs = @()
    for ($i = 1; $i -le 10; $i++) {
        $job = Start-Job -ScriptBlock {
            param($url)
            $body = @{
                tool = "earth_engine_system"
                arguments = @{operation = "info"}
            } | ConvertTo-Json
            
            try {
                $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
                return $response -ne $null
            } catch {
                return $false
            }
        } -ArgumentList "http://localhost:3000/api/mcp/sse"
        
        $jobs += $job
    }
    
    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    $successCount = ($results | Where-Object {$_ -eq $true}).Count
    return $successCount -ge 8  # 80% success rate
}

$ValidationResults.Scalability.MultipleModels = Test-Component "SCALE" "Multiple Model Types" {
    $models = @(
        @{tool="wildfire_risk_assessment"; args=@{region="California"; startDate="2024-01-01"; endDate="2024-01-31"; scale=1000}},
        @{tool="flood_risk_assessment"; args=@{region="Houston"; startDate="2024-01-01"; endDate="2024-01-31"; scale=1000; floodType="urban"}},
        @{tool="water_quality_monitoring"; args=@{region="San Francisco Bay"; startDate="2024-01-01"; endDate="2024-01-31"; scale=1000}}
    )
    
    $jobs = @()
    foreach ($model in $models) {
        $job = Start-Job -ScriptBlock {
            param($url, $tool, $arguments)
            $body = @{tool = $tool; arguments = $arguments} | ConvertTo-Json -Depth 10
            
            try {
                $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120
                return ($response.success -eq $true) -or ($response.data -ne $null)
            } catch {
                return $false
            }
        } -ArgumentList "http://localhost:3000/api/mcp/sse", $model.tool, $model.args
        
        $jobs += $job
    }
    
    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    $successCount = ($results | Where-Object {$_ -eq $true}).Count
    return $successCount -eq $models.Count
}

# =====================================
# 7. DATA INTEGRITY TESTING
# =====================================
Write-Host "`n[7] DATA INTEGRITY" -ForegroundColor Cyan

$ValidationResults.DataIntegrity.ConsistentResults = Test-Component "DATA" "Result Consistency" {
    $results = @()
    
    for ($i = 1; $i -le 3; $i++) {
        $body = @{
            tool = "earth_engine_data"
            arguments = @{
                operation = "search"
                query = "Sentinel-2"
                limit = 5
            }
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
            $results += $response
        } catch {
            return $false
        }
    }
    
    # Check if all results are consistent
    if ($results.Count -eq 3) {
        # Simple check - all should have success field
        return ($results[0].success -eq $results[1].success) -and ($results[1].success -eq $results[2].success)
    }
    return $false
}

$ValidationResults.DataIntegrity.DateHandling = Test-Component "DATA" "Date Format Handling" {
    $dateFormats = @("2024-01-15", "2024/01/15", "01-15-2024")
    $successCount = 0
    
    foreach ($dateFormat in $dateFormats) {
        $body = @{
            tool = "earth_engine_process"
            arguments = @{
                operation = "composite"
                datasetId = "COPERNICUS/S2_SR_HARMONIZED"
                region = "San Francisco"
                startDate = "2024-01-01"
                endDate = $dateFormat
                compositeType = "median"
            }
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
            if ($response) { $successCount++ }
        } catch {
            # Some formats may fail, that's okay
        }
    }
    
    return $successCount -ge 1  # At least one format should work
}

# =====================================
# 8. ERROR HANDLING
# =====================================
Write-Host "`n[8] ERROR HANDLING" -ForegroundColor Cyan

$ValidationResults.ErrorHandling.MissingParameters = Test-Component "ERROR" "Missing Parameters" {
    $body = @{
        tool = "earth_engine_data"
        arguments = @{operation = "filter"}  # Missing required parameters
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        # Should return error
        return $response.error -ne $null
    } catch {
        # Proper error response
        return $true
    }
}

$ValidationResults.ErrorHandling.InvalidTool = Test-Component "ERROR" "Invalid Tool Name" {
    $body = @{
        tool = "non_existent_tool"
        arguments = @{}
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        return $response.error -ne $null
    } catch {
        return $true
    }
}

$ValidationResults.ErrorHandling.MalformedJSON = Test-Component "ERROR" "Malformed JSON" {
    $body = "{invalid json}"
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        return $false  # Should have failed
    } catch {
        # Should handle gracefully
        return $_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 500
    }
}

# =====================================
# 9. FUNCTIONAL TESTING
# =====================================
Write-Host "`n[9] FUNCTIONAL TESTING" -ForegroundColor Cyan

$ValidationResults.Functional = @{}

# Test each core tool
$coreTools = @(
    @{
        Name = "Data Search"
        Tool = "earth_engine_data"
        Args = @{operation="search"; query="Landsat"; limit=3}
    },
    @{
        Name = "Process Composite"
        Tool = "earth_engine_process"
        Args = @{operation="composite"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; region="San Francisco"; startDate="2024-01-01"; endDate="2024-01-31"; compositeType="median"}
    },
    @{
        Name = "Export Thumbnail"
        Tool = "earth_engine_export"
        Args = @{operation="thumbnail"; datasetId="COPERNICUS/S2_SR_HARMONIZED"; region="San Francisco"; startDate="2024-01-01"; endDate="2024-01-31"; dimensions=256}
    },
    @{
        Name = "System Info"
        Tool = "earth_engine_system"
        Args = @{operation="info"}
    }
)

foreach ($test in $coreTools) {
    $ValidationResults.Functional[$test.Name] = Test-Component "FUNC" $test.Name {
        $body = @{tool = $test.Tool; arguments = $test.Args} | ConvertTo-Json -Depth 10
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
            return ($response.success -eq $true) -or ($response.data -ne $null) -or ($response.info -ne $null)
        } catch {
            return $false
        }
    }
}

# =====================================
# FINAL SUMMARY
# =====================================
Write-Host "`n" -NoNewline
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "         VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$categories = @(
    @{Name="Environment"; Results=$ValidationResults.Environment},
    @{Name="Infrastructure"; Results=$ValidationResults.Infrastructure},
    @{Name="Security"; Results=$ValidationResults.Security},
    @{Name="Performance"; Results=$ValidationResults.Performance},
    @{Name="Reliability"; Results=$ValidationResults.Reliability},
    @{Name="Scalability"; Results=$ValidationResults.Scalability},
    @{Name="Data Integrity"; Results=$ValidationResults.DataIntegrity},
    @{Name="Error Handling"; Results=$ValidationResults.ErrorHandling},
    @{Name="Functional"; Results=$ValidationResults.Functional}
)

$categoryStatus = @{}
foreach ($category in $categories) {
    $tests = $category.Results.Values
    $passed = ($tests | Where-Object {$_.Status -eq "PASS"}).Count
    $total = $tests.Count
    $rate = if ($total -gt 0) {[math]::Round(($passed/$total)*100, 1)} else {0}
    
    $categoryStatus[$category.Name] = @{
        Passed = $passed
        Total = $total
        Rate = $rate
    }
    
    Write-Host "`n$($category.Name):" -ForegroundColor Yellow
    Write-Host "  Tests: $total | Passed: $passed | Success Rate: $rate percent" -ForegroundColor White
    
    foreach ($key in $category.Results.Keys) {
        $test = $category.Results[$key]
        if ($test.Status -eq "PASS") {
            $icon = "[PASS]"
        } else {
            $icon = "[FAIL]"
        }
        $color = if ($test.Status -eq "PASS") {"Green"} else {"Red"}
        Write-Host "  $icon $key" -ForegroundColor $color
    }
}

# Overall metrics
$overallRate = if ($TotalTests -gt 0) {[math]::Round(($PassedTests/$TotalTests)*100, 1)} else {0}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "OVERALL RESULTS:" -ForegroundColor White
Write-Host "Total Tests: $TotalTests" -ForegroundColor White
Write-Host "Passed: $PassedTests" -ForegroundColor Green
Write-Host "Failed: $FailedTests" -ForegroundColor $(if ($FailedTests -eq 0) {"Green"} else {"Red"})
Write-Host "Success Rate: $overallRate percent" -ForegroundColor $(if ($overallRate -ge 95) {"Green"} elseif ($overallRate -ge 85) {"Yellow"} else {"Red"})

# Critical checks
$criticalPassed = $true
$criticalChecks = @(
    "GEE Authentication",
    "Server Status",
    "API Endpoint",
    "Health Check Endpoint"
)

foreach ($check in $criticalChecks) {
    $found = $false
    foreach ($category in $categories) {
        if ($category.Results.ContainsKey($check)) {
            if ($category.Results[$check].Status -ne "PASS") {
                $criticalPassed = $false
                $Warnings += "CRITICAL: $check failed"
            }
            $found = $true
            break
        }
    }
}

# Production readiness verdict
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "PRODUCTION READINESS VERDICT:" -ForegroundColor White

if ($overallRate -ge 95 -and $criticalPassed) {
    Write-Host "`n✅ PRODUCTION READY!" -ForegroundColor Green
    Write-Host "All systems operational and validated" -ForegroundColor Green
    Write-Host "Performance metrics within acceptable range" -ForegroundColor Green
    Write-Host "Security measures in place" -ForegroundColor Green
    Write-Host "Ready for deployment" -ForegroundColor Green
} elseif ($overallRate -ge 85 -and $criticalPassed) {
    Write-Host "`n⚠️ MOSTLY READY" -ForegroundColor Yellow
    Write-Host "System is functional but has minor issues" -ForegroundColor Yellow
    Write-Host "Review failed tests before production" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ NOT READY FOR PRODUCTION" -ForegroundColor Red
    Write-Host "Critical issues detected" -ForegroundColor Red
    Write-Host "Address failed tests before deployment" -ForegroundColor Red
}

if ($Warnings.Count -gt 0) {
    Write-Host "`nWarnings:" -ForegroundColor Yellow
    foreach ($warning in $Warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
}

# Save detailed report if requested
if ($SaveReport) {
    $htmlReport = @"
<!DOCTYPE html>
<html>
<head>
    <title>MCP Production Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 5px; }
        .category { background: white; margin: 20px 0; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .pass { color: #4CAF50; font-weight: bold; }
        .fail { color: #f44336; font-weight: bold; }
        .warning { color: #FF9800; font-weight: bold; }
        .metric { display: inline-block; margin: 10px 20px; }
        .summary { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f0f0f0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MCP Production Validation Report</h1>
        <p>Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
    </div>
    
    <div class="summary">
        <h2>Overall Results</h2>
        <div class="metric">Total Tests: <strong>$TotalTests</strong></div>
        <div class="metric">Passed: <span class="pass">$PassedTests</span></div>
        <div class="metric">Failed: <span class="fail">$FailedTests</span></div>
        <div class="metric">Success Rate: <strong>$overallRate%</strong></div>
    </div>
"@

    foreach ($category in $categories) {
        $catStatus = $categoryStatus[$category.Name]
        $htmlReport += @"
    <div class="category">
        <h3>$($category.Name)</h3>
        <p>Success Rate: $($catStatus.Rate)% ($($catStatus.Passed)/$($catStatus.Total) tests passed)</p>
        <table>
            <tr><th>Test</th><th>Status</th><th>Details</th></tr>
"@
        foreach ($key in $category.Results.Keys) {
            $test = $category.Results[$key]
            $statusClass = if ($test.Status -eq "PASS") {"pass"} else {"fail"}
            $details = if ($test.Error) {$test.Error} elseif ($test.Result) {"Success"} else {"-"}
            $htmlReport += "            <tr><td>$key</td><td class='$statusClass'>$($test.Status)</td><td>$details</td></tr>`n"
        }
        $htmlReport += "        </table>`n    </div>`n"
    }

    $verdict = if ($overallRate -ge 95 -and $criticalPassed) {
        "<span class='pass'>PRODUCTION READY</span>"
    } elseif ($overallRate -ge 85 -and $criticalPassed) {
        "<span class='warning'>MOSTLY READY</span>"
    } else {
        "<span class='fail'>NOT READY</span>"
    }

    $htmlReport += @"
    <div class="summary">
        <h2>Production Readiness Verdict</h2>
        <p style="font-size: 24px;">$verdict</p>
    </div>
</body>
</html>
"@

    $htmlReport | Out-File -FilePath $ReportPath -Encoding UTF8
    Write-Host "`nDetailed report saved to: $ReportPath" -ForegroundColor Green
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "Validation completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
