# Status check script for Axion Planetary MCP deployment

Write-Host "🔍 Checking deployment status..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Gray

$url = "https://axion-planetary-mcp.onrender.com/api/health"
$maxAttempts = 60
$attemptInterval = 10
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "`nAttempt $attempt of $maxAttempts..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "`n✅ SERVICE IS LIVE!" -ForegroundColor Green
            Write-Host "================================" -ForegroundColor Green
            Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
            Write-Host "`nYour users can now use the service!" -ForegroundColor Green
            Write-Host "Share the config from USER_CONFIG.json" -ForegroundColor Yellow
            break
        }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "❌ 404 - Service deployed but health endpoint not found" -ForegroundColor Red
            Write-Host "Check if the API routes are working properly" -ForegroundColor Yellow
            break
        } else {
            Write-Host "⏳ Not ready yet... (Error: $($_.Exception.Message))" -ForegroundColor Gray
        }
    }
    
    if ($attempt -lt $maxAttempts) {
        Write-Host "Waiting $attemptInterval seconds before next check..." -ForegroundColor Gray
        Start-Sleep -Seconds $attemptInterval
    }
}

if ($attempt -eq $maxAttempts) {
    Write-Host "`n⚠️ Service did not become available after $($maxAttempts * $attemptInterval / 60) minutes" -ForegroundColor Red
    Write-Host "Check the deployment logs at:" -ForegroundColor Yellow
    Write-Host "https://dashboard.render.com/web/srv-d35a66ogjchc73ev1060/logs" -ForegroundColor Cyan
}

Write-Host "`n================================" -ForegroundColor Gray
Write-Host ('Dashboard: ' + 'https://dashboard.render.com/web/srv-d35a66ogjchc73ev1060') -ForegroundColor Cyan
