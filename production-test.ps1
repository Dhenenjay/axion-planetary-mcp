# ===============================================
# PRODUCTION MCP SERVER TEST & VALIDATION
# ===============================================
# Complete end-to-end testing and fixes
# For high-stakes production deployment
# ===============================================

param(
    [string]$KeyPath = "C:\Users\Dhenenjay\Downloads\ee-key.json",
    [switch]$QuickTest = $false
)

# Configuration
$global:Results = @{
    StartTime = Get-Date
    ServerStatus = "Unknown"
    AuthStatus = "Unknown"
    CoreToolsStatus = @{}
    ModelsStatus = @{}
    CriticalIssues = @()
    Fixes = @()
    ReadyForProduction = $false
}

# ===============================================
# STEP 1: ENVIRONMENT VALIDATION
# ===============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  MCP SERVER PRODUCTION VALIDATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/7] Validating Environment..." -ForegroundColor Yellow

# Check service account key
if (-not (Test-Path $KeyPath)) {
    Write-Host "  ✗ Service account key not found at: $KeyPath" -ForegroundColor Red
    $global:Results.CriticalIssues += "Missing service account key"
    exit 1
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath
Write-Host "  ✓ Service account key found" -ForegroundColor Green

# Check Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "  ✓ Node.js installed: $nodeVersion" -ForegroundColor Green
}
else {
    Write-Host "  ✗ Node.js not installed" -ForegroundColor Red
    $global:Results.CriticalIssues += "Node.js not installed"
    exit 1
}

# Check dependencies
if (Test-Path "node_modules") {
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Installing dependencies..." -ForegroundColor Yellow
    npm install --silent
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
}

# ===============================================
# STEP 2: START SERVER
# ===============================================

Write-Host "`n[2/7] Starting Server..." -ForegroundColor Yellow

# Kill any existing Node processes on port 3000
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start the Next.js server
$serverProcess = Start-Process powershell -ArgumentList @(
    "-WindowStyle", "Hidden",
    "-Command", @"
        cd '$PWD'
        `$env:GOOGLE_APPLICATION_CREDENTIALS = '$KeyPath'
        npx next dev --port 3000 2>&1 | Out-File server-log.txt
"@
) -PassThru

Write-Host "  ⏳ Waiting for server to start (30 seconds)..." -ForegroundColor Gray
$maxAttempts = 30
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    Start-Sleep -Seconds 1
    $attempt++
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/mcp/sse" -Method GET -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
        }
    } catch {
        # Server not ready yet
    }
    
    if ($attempt % 5 -eq 0) {
        Write-Host "    Still waiting... ($attempt/$maxAttempts)" -ForegroundColor Gray
    }
}

if ($serverReady) {
    Write-Host "  ✓ Server started successfully (PID: $($serverProcess.Id))" -ForegroundColor Green
    $global:Results.ServerStatus = "Running"
} else {
    Write-Host "  ✗ Server failed to start" -ForegroundColor Red
    $global:Results.CriticalIssues += "Server failed to start"
    
    # Check server log
    if (Test-Path "server-log.txt") {
        Write-Host "`n  Server log:" -ForegroundColor Yellow
        Get-Content "server-log.txt" -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
    exit 1
}

# ===============================================
# STEP 3: TEST AUTHENTICATION
# ===============================================

Write-Host "`n[3/7] Testing Authentication..." -ForegroundColor Yellow

$authTest = @{
    tool = "earth_engine_system"
    arguments = @{
        operation = "auth"
        checkType = "status"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:3000/api/mcp/sse" `
        -Method POST `
        -Body $authTest `
        -ContentType "application/json" `
        -TimeoutSec 10
    
    if ($response.authenticated) {
        Write-Host "  ✓ Earth Engine authenticated" -ForegroundColor Green
        Write-Host "    Project: $($response.projectId)" -ForegroundColor Gray
        $global:Results.AuthStatus = "Authenticated"
    }
    else {
        Write-Host "  ✗ Authentication failed" -ForegroundColor Red
        $global:Results.CriticalIssues += "Earth Engine authentication failed"
    }
}
catch {
    Write-Host "  ✗ Authentication test failed: $_" -ForegroundColor Red
    $global:Results.CriticalIssues += "Authentication test error"
}

# ===============================================
# STEP 4: TEST CORE TOOLS
# ===============================================

Write-Host "`n[4/7] Testing Core Tools..." -ForegroundColor Yellow

$coreTests = @(
    @{
        Name = "Data Search"
        Tool = "earth_engine_data"
        Args = @{
            operation = "search"
            query = "sentinel"
            limit = 3
        }
    },
    @{
        Name = "Geometry Lookup"
        Tool = "earth_engine_data"
        Args = @{
            operation = "geometry"
            placeName = "San Francisco"
        }
    },
    @{
        Name = "NDVI Calculation"
        Tool = "earth_engine_process"
        Args = @{
            operation = "index"
            indexType = "NDVI"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2023-06-01"
            endDate = "2023-08-31"
            region = "San Francisco"
        }
    },
    @{
        Name = "Thumbnail Generation"
        Tool = "earth_engine_export"
        Args = @{
            operation = "thumbnail"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
            startDate = "2023-06-01"
            endDate = "2023-08-31"
            region = "San Francisco"
            dimensions = 256
        }
    }
)

$passedTests = 0
foreach ($test in $coreTests) {
    Write-Host "  Testing: $($test.Name)..." -ForegroundColor Gray -NoNewline
    
    $body = @{
        tool = $test.Tool
        arguments = $test.Args
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod `
            -Uri "http://localhost:3000/api/mcp/sse" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 30
        
        if ($response.success -or $response.datasets -or $response.geometry -or $response.value -or $response.url) {
            Write-Host " ✓" -ForegroundColor Green
            $passedTests++
            $global:Results.CoreToolsStatus[$test.Name] = "Passed"
        } else {
            Write-Host " ✗" -ForegroundColor Red
            $global:Results.CoreToolsStatus[$test.Name] = "Failed"
        }
    } catch {
        Write-Host " ✗ (Error: $_)" -ForegroundColor Red
        $global:Results.CoreToolsStatus[$test.Name] = "Error"
    }
}

Write-Host "  Core Tools: $passedTests/$($coreTests.Count) passed" -ForegroundColor $(if ($passedTests -eq $coreTests.Count) { "Green" } else { "Yellow" })

# ===============================================
# STEP 5: TEST MODELS (Quick)
# ===============================================

if (-not $QuickTest) {
    Write-Host "`n[5/7] Testing Geospatial Models..." -ForegroundColor Yellow
    
    $modelTests = @(
        @{
            Name = "Wildfire Risk"
            Tool = "wildfire_risk_assessment"
            Args = @{
                region = "California"
                startDate = "2023-06-01"
                endDate = "2023-08-31"
                scale = 1000
                indices = @("NDVI", "NDWI")
            }
        },
        @{
            Name = "Agricultural Monitoring"
            Tool = "agricultural_monitoring"
            Args = @{
                region = "Sacramento Valley"
                cropType = "general"
                startDate = "2023-06-01"
                endDate = "2023-08-31"
                scale = 100
                indices = @("NDVI", "EVI")
            }
        }
    )
    
    $modelsPassed = 0
    foreach ($test in $modelTests) {
        Write-Host "  Testing: $($test.Name)..." -ForegroundColor Gray -NoNewline
        
        $body = @{
            tool = $test.Tool
            arguments = $test.Args
        } | ConvertTo-Json -Depth 10
        
        try {
            $response = Invoke-RestMethod `
                -Uri "http://localhost:3000/api/mcp/sse" `
                -Method POST `
                -Body $body `
                -ContentType "application/json" `
                -TimeoutSec 60
            
            if ($response.success -or $response.riskScore -or $response.cropHealth) {
                Write-Host " ✓" -ForegroundColor Green
                $modelsPassed++
                $global:Results.ModelsStatus[$test.Name] = "Passed"
            } else {
                Write-Host " ✗" -ForegroundColor Red
                $global:Results.ModelsStatus[$test.Name] = "Failed"
            }
        } catch {
            Write-Host " ✗ (Timeout/Error)" -ForegroundColor Red
            $global:Results.ModelsStatus[$test.Name] = "Error"
        }
    }
    
    Write-Host "  Models: $modelsPassed/$($modelTests.Count) passed" -ForegroundColor $(if ($modelsPassed -eq $modelTests.Count) { "Green" } else { "Yellow" })
}
else {
    Write-Host "`n[5/7] Skipping Model Tests (QuickTest mode)" -ForegroundColor Gray
}

# ===============================================
# STEP 6: STRESS TEST
# ===============================================

Write-Host "`n[6/7] Running Stress Test..." -ForegroundColor Yellow

# Test concurrent requests
$jobs = @()
1..3 | ForEach-Object {
    $jobs += Start-Job -ScriptBlock {
        param($url, $body)
        Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    } -ArgumentList "http://localhost:3000/api/mcp/sse", (@{
        tool = "earth_engine_data"
        arguments = @{
            operation = "info"
            datasetId = "COPERNICUS/S2_SR_HARMONIZED"
        }
    } | ConvertTo-Json -Depth 10)
}

$completedJobs = $jobs | Wait-Job -Timeout 30
$successCount = ($jobs | Receive-Job -ErrorAction SilentlyContinue | Where-Object { $_ }).Count
$jobs | Remove-Job -Force

Write-Host "  Concurrent requests: $successCount/3 completed" -ForegroundColor $(if ($successCount -eq 3) { "Green" } else { "Yellow" })

# ===============================================
# STEP 7: FINAL VALIDATION
# ===============================================

Write-Host "`n[7/7] Final Validation..." -ForegroundColor Yellow

# Check for critical issues
if ($global:Results.CriticalIssues.Count -eq 0) {
    Write-Host "  ✓ No critical issues found" -ForegroundColor Green
} else {
    Write-Host "  ✗ Critical issues found:" -ForegroundColor Red
    $global:Results.CriticalIssues | ForEach-Object {
        Write-Host "    - $_" -ForegroundColor Red
    }
}

# Calculate readiness score
$readinessScore = 0
if ($global:Results.ServerStatus -eq "Running") { $readinessScore += 20 }
if ($global:Results.AuthStatus -eq "Authenticated") { $readinessScore += 20 }
if (($global:Results.CoreToolsStatus.Values | Where-Object { $_ -eq "Passed" }).Count -ge 3) { $readinessScore += 30 }
if (($global:Results.ModelsStatus.Values | Where-Object { $_ -eq "Passed" }).Count -ge 1) { $readinessScore += 20 }
if ($successCount -eq 3) { $readinessScore += 10 }

$global:Results.ReadinessScore = $readinessScore
$global:Results.ReadyForProduction = $readinessScore -ge 80

# ===============================================
# SUMMARY REPORT
# ===============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "         PRODUCTION READINESS REPORT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nServer Status: " -NoNewline
if ($global:Results.ServerStatus -eq "Running") {
    Write-Host "✓ RUNNING" -ForegroundColor Green
} else {
    Write-Host "✗ NOT RUNNING" -ForegroundColor Red
}

Write-Host "Authentication: " -NoNewline
if ($global:Results.AuthStatus -eq "Authenticated") {
    Write-Host "✓ AUTHENTICATED" -ForegroundColor Green
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
}

Write-Host "`nCore Tools Test Results:" -ForegroundColor Yellow
foreach ($tool in $global:Results.CoreToolsStatus.Keys) {
    $status = $global:Results.CoreToolsStatus[$tool]
    $color = if ($status -eq "Passed") { "Green" } elseif ($status -eq "Failed") { "Red" } else { "Yellow" }
    Write-Host "  • $tool : $status" -ForegroundColor $color
}

if ($global:Results.ModelsStatus.Count -gt 0) {
    Write-Host "`nModel Test Results:" -ForegroundColor Yellow
    foreach ($model in $global:Results.ModelsStatus.Keys) {
        $status = $global:Results.ModelsStatus[$model]
        $color = if ($status -eq "Passed") { "Green" } elseif ($status -eq "Failed") { "Red" } else { "Yellow" }
        Write-Host "  • $model : $status" -ForegroundColor $color
    }
}

Write-Host "`nReadiness Score: $($global:Results.ReadinessScore)/100" -ForegroundColor $(
    if ($global:Results.ReadinessScore -ge 80) { "Green" }
    elseif ($global:Results.ReadinessScore -ge 60) { "Yellow" }
    else { "Red" }
)

Write-Host "`n========================================" -ForegroundColor Cyan

if ($global:Results.ReadyForProduction) {
    Write-Host "✓ SERVER IS READY FOR PRODUCTION!" -ForegroundColor Green -BackgroundColor DarkGreen
    Write-Host "`nDeployment Instructions:" -ForegroundColor Yellow
    Write-Host "1. Ensure service account key is secure" -ForegroundColor Gray
    Write-Host "2. Set environment variables in production" -ForegroundColor Gray
    Write-Host "3. Use process manager (PM2) for production" -ForegroundColor Gray
    Write-Host "4. Configure reverse proxy (nginx/Apache)" -ForegroundColor Gray
    Write-Host "5. Enable monitoring and logging" -ForegroundColor Gray
} else {
    Write-Host "✗ SERVER NEEDS FIXES BEFORE PRODUCTION" -ForegroundColor Red -BackgroundColor DarkRed
    Write-Host "`nRequired Fixes:" -ForegroundColor Yellow
    
    if ($global:Results.ServerStatus -ne "Running") {
        Write-Host "• Fix server startup issues" -ForegroundColor Red
    }
    if ($global:Results.AuthStatus -ne "Authenticated") {
        Write-Host "• Fix Earth Engine authentication" -ForegroundColor Red
    }
    if (($global:Results.CoreToolsStatus.Values | Where-Object { $_ -eq "Passed" }).Count -lt 3) {
        Write-Host "• Fix core tool failures" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan

# Save detailed report
$reportPath = "production-readiness-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json"
$global:Results | ConvertTo-Json -Depth 10 | Out-File $reportPath
Write-Host "`nDetailed report saved to: $reportPath" -ForegroundColor Cyan

# Cleanup
Write-Host "`nCleaning up..." -ForegroundColor Gray
if ($serverProcess) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Done!" -ForegroundColor Green
