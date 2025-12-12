# Start Earth Engine MCP Server with proper environment configuration

Write-Host "🚀 Starting Earth Engine MCP Server..." -ForegroundColor Green
Write-Host ""

# Add Node.js to PATH
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

# Verify Node.js is available
$nodeVersion = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green

# Set the working directory
Set-Location "C:\Users\Dhenenjay\earth-engine-mcp"
Write-Host "📁 Working directory: $(Get-Location)" -ForegroundColor Cyan

# Check if .env.local exists
if (Test-Path ".env.local") {
    Write-Host "✅ Environment file found" -ForegroundColor Green
} else {
    Write-Host "⚠️ Warning: .env.local not found" -ForegroundColor Yellow
}

# Kill any existing Next.js processes on port 3000
Write-Host ""
Write-Host "🔍 Checking for existing processes on port 3000..." -ForegroundColor Yellow
$existingProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProcess) {
    foreach ($pid in $existingProcess) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "✅ Stopped existing process (PID: $pid)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Could not stop process $pid" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

# Build the project first (optional, comment out if already built)
Write-Host ""
Write-Host "🔨 Building the project..." -ForegroundColor Yellow
Write-Host "Running: npm run build"
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please check the errors above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Build successful!" -ForegroundColor Green

# Start the server
Write-Host ""
Write-Host "🌐 Starting Next.js server on http://localhost:3000" -ForegroundColor Green
Write-Host "📡 SSE endpoint will be available at: http://localhost:3000/api/mcp/sse" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Earth Engine MCP Server with" -ForegroundColor White
Write-Host "  🌍 GLOBAL SHAPEFILE SUPPORT 🌍" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Supported global locations:" -ForegroundColor Yellow
Write-Host "  • Cities: Paris, Tokyo, Mumbai, São Paulo, Cairo, Sydney, etc." -ForegroundColor White
Write-Host "  • Countries: France, Japan, Brazil, India, Egypt, Australia, etc." -ForegroundColor White
Write-Host "  • With context: 'Paris, France', 'Tokyo, Japan', etc." -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Start the server
& npm start

# Keep the window open if the server stops
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Server stopped with error code: $LASTEXITCODE" -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
