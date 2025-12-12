# Start Next.js server for Earth Engine MCP
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\Dhenenjay\Downloads\ee-key.json"
$env:GCP_PROJECT_ID = "stoked-flame-455410-k2"
$env:NODE_ENV = "development"

Write-Host "Starting Earth Engine MCP Server..." -ForegroundColor Green
Write-Host "Earth Engine key: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Yellow
Write-Host "Project ID: $env:GCP_PROJECT_ID" -ForegroundColor Yellow
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host "  SSE Endpoint: http://localhost:3000/api/mcp/sse" -ForegroundColor White
Write-Host ""

# Run Next.js dev server
& "C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" dev
