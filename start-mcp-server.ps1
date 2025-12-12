$Host.UI.RawUI.WindowTitle = 'MCP Server - Earth Engine'
Write-Host '======================================' -ForegroundColor Cyan
Write-Host '   EARTH ENGINE MCP SERVER' -ForegroundColor Cyan
Write-Host '======================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Setting environment...' -ForegroundColor Yellow
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\Dhenenjay\Downloads\ee-key.json'
Write-Host "Service Account: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
Write-Host ''
Write-Host 'Starting Next.js server on port 3000...' -ForegroundColor Yellow
Write-Host ''
Set-Location 'C:\Users\Dhenenjay\earth-engine-mcp'
npx next dev --port 3000
