# Test script for hosted MCP service
Write-Host "🧪 MCP Hosted Service Test Suite" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$baseUrl = "https://axion-planetary-mcp.onrender.com"
$testResults = @()

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int]$Timeout = 10
    )
    
    Write-Host "`nTesting: $Name" -ForegroundColor Yellow
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = $Timeout
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 3)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        
        Write-Host "  ✅ Success - Status: $($response.StatusCode)" -ForegroundColor Green
        
        # Parse JSON response if possible
        try {
            $content = $response.Content | ConvertFrom-Json
            Write-Host "  Response: $($content | ConvertTo-Json -Compress)" -ForegroundColor Gray
        } catch {
            Write-Host "  Response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
        }
        
        return @{
            Test = $Name
            Result = "PASS"
            Status = $response.StatusCode
        }
    } catch {
        Write-Host "  ❌ Failed - Error: $($_.Exception.Message)" -ForegroundColor Red
        return @{
            Test = $Name
            Result = "FAIL"
            Error = $_.Exception.Message
        }
    }
}

# Run tests
Write-Host "`n📋 Running Test Suite..." -ForegroundColor Cyan

# Test 1: Health Check
$testResults += Test-Endpoint -Name "Health Check" -Url "$baseUrl/api/health"

# Test 2: SSE Endpoint (GET)
$testResults += Test-Endpoint -Name "SSE Analytics" -Url "$baseUrl/api/mcp/sse"

# Test 3: SSE Endpoint (OPTIONS) - CORS preflight
$testResults += Test-Endpoint -Name "CORS Preflight" -Url "$baseUrl/api/mcp/sse" -Method "OPTIONS"

# Test 4: Simple Tool Call
$testResults += Test-Endpoint -Name "Simple Tool Call" -Url "$baseUrl/api/mcp/sse" -Method "POST" -Body @{
    method = "tools/call"
    params = @{
        tool = "earth_engine_data"
        arguments = @{
            operation = "search"
            query = "landsat"
            limit = 1
        }
    }
} -Timeout 30

# Test Summary
Write-Host "`n📊 Test Summary" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan

$passed = ($testResults | Where-Object { $_.Result -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Result -eq "FAIL" }).Count

foreach ($test in $testResults) {
    $icon = if ($test.Result -eq "PASS") { "✅" } else { "❌" }
    $color = if ($test.Result -eq "PASS") { "Green" } else { "Red" }
    Write-Host "$icon $($test.Test): $($test.Result)" -ForegroundColor $color
}

Write-Host "`n📈 Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

# Service Status
Write-Host "`n🌐 Service Status" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host "URL: $baseUrl" -ForegroundColor White
Write-Host "Health Endpoint: $baseUrl/api/health" -ForegroundColor White
Write-Host "SSE Endpoint: $baseUrl/api/mcp/sse" -ForegroundColor White

if ($failed -eq 0) {
    Write-Host "`n✅ Service is ready for production use!" -ForegroundColor Green
} else {
    Write-Host ("`n" + 'Some tests failed. Check the logs above.') -ForegroundColor Yellow
}
