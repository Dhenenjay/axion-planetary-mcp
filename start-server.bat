@echo off
echo Starting MCP Server...
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Dhenenjay\Downloads\ee-key.json
cd /d C:\Users\Dhenenjay\earth-engine-mcp
call npm run build:next
call npm run start:next
pause
