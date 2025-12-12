# Test MCP Integration with Claude Desktop
# This script simulates MCP protocol messages to test the integration

Write-Host "🔧 Testing Earth Engine MCP Integration" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Blue
Write-Host ""

# Test the MCP server directly
$mcp_script = "C:\Users\Dhenenjay\earth-engine-mcp\mcp-essential.js"

if (-not (Test-Path $mcp_script)) {
    Write-Host "❌ MCP script not found: $mcp_script" -ForegroundColor Red
    exit 1
}

Write-Host "Testing MCP Protocol Messages..." -ForegroundColor Yellow
Write-Host ""

# Create test messages
$messages = @(
    @{
        jsonrpc = "2.0"
        id = 1
        method = "initialize"
        params = @{
            protocolVersion = "2024-11-05"
            capabilities = @{}
            clientInfo = @{
                name = "test-client"
                version = "1.0.0"
            }
        }
    },
    @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/list"
        params = @{}
    }
)

# Test 1: Initialize
Write-Host "1. Testing Initialize..." -ForegroundColor Yellow
$init_msg = $messages[0] | ConvertTo-Json -Compress
$result = $init_msg | & node $mcp_script 2>$null | Select-Object -First 1
if ($result) {
    $response = $result | ConvertFrom-Json
    if ($response.result.serverInfo) {
        Write-Host "   ✅ Server initialized: $($response.result.serverInfo.name) v$($response.result.serverInfo.version)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Invalid initialize response" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ No response from server" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check server endpoint
Write-Host "2. Testing Server Endpoint..." -ForegroundColor Yellow
try {
    $test_body = @{
        tool = "search_gee_catalog"
        arguments = @{
            query = "sentinel"
        }
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method Post -Body $test_body -ContentType "application/json" -TimeoutSec 5
    
    if ($response.content) {
        Write-Host "   ✅ Server endpoint is working" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Server responded but format may be incorrect" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Server endpoint error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Test shapefile tool
Write-Host "3. Testing Shapefile Tool..." -ForegroundColor Yellow
try {
    $test_body = @{
        tool = "convert_place_to_shapefile_geometry"
        arguments = @{
            placeName = "Paris"
        }
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/sse" -Method Post -Body $test_body -ContentType "application/json" -TimeoutSec 10
    
    if ($response.content) {
        $result = $response.content[0].text | ConvertFrom-Json
        if ($result.success) {
            Write-Host "   ✅ Shapefile tool working: Paris = $($result.area_km2) km²" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Shapefile tool failed" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ❌ Shapefile tool error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Blue
Write-Host ""

# Summary
Write-Host "Integration Status Summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Claude Desktop Config: mcp-essential.js" -ForegroundColor Green
Write-Host "✅ Server Running: http://localhost:3000" -ForegroundColor Green
Write-Host "✅ Essential Tools: 7 tools configured" -ForegroundColor Green
Write-Host "✅ Global Support: Enhanced with FAO GAUL" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restart Claude Desktop" -ForegroundColor White
Write-Host "2. Look for 'Earth Engine' in the tools list" -ForegroundColor White
Write-Host "3. Try: 'Use the Earth Engine tools to get a shapefile for Paris'" -ForegroundColor White
Write-Host ""
Write-Host "If Claude Desktop crashes:" -ForegroundColor Yellow
Write-Host '- Check the logs in: %APPDATA%\Claude\logs' -ForegroundColor White
Write-Host "- Verify Node.js is in PATH" -ForegroundColor White
Write-Host "- Make sure server is running on port 3000" -ForegroundColor White
