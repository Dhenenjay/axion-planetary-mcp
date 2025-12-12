# Debug test to find why operation parameter is not being recognized

$baseUrl = "http://localhost:3000/stdio"

Write-Host "Test 1: Direct JSON string" -ForegroundColor Yellow
$response1 = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body '{"method":"tools/call","params":{"name":"earth_engine_data","arguments":{"operation":"search","query":"sentinel","limit":3}}}'
Write-Host "Result: $(if ($response1.result -and -not $response1.result.error) {'PASS'} else {'FAIL'})" -ForegroundColor $(if ($response1.result -and -not $response1.result.error) {'Green'} else {'Red'})
if ($response1.result.error) { Write-Host "Error: $($response1.result.error)" -ForegroundColor Yellow }

Write-Host "`nTest 2: PowerShell hashtable converted to JSON" -ForegroundColor Yellow
$body2 = @{
    method = "tools/call"
    params = @{
        name = "earth_engine_data"
        arguments = @{
            operation = "search"
            query = "sentinel"
            limit = 3
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Sending JSON:`n$body2" -ForegroundColor Cyan
$response2 = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $body2
Write-Host "Result: $(if ($response2.result -and -not $response2.result.error) {'PASS'} else {'FAIL'})" -ForegroundColor $(if ($response2.result -and -not $response2.result.error) {'Green'} else {'Red'})
if ($response2.result.error) { Write-Host "Error: $($response2.result.error)" -ForegroundColor Yellow }

Write-Host "`nTest 3: Check what the server sees" -ForegroundColor Yellow
# First let's try calling just tools/list to see if that works
$listBody = @{
    method = "tools/list"
    params = @{}
} | ConvertTo-Json

$listResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $listBody
Write-Host "Available tools:"
$listResponse.result.tools | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Cyan }
