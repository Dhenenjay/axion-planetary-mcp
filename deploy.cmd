@echo off
echo Starting Render Deployment...
echo.

set RENDER_API_KEY=rnd_HrUPmuClpea4qQYltm9hs8YfWEgw
set GEE_FILE=C:\Users\Dhenenjay\Downloads\axion-orbital-46448075249c.json

echo Checking for existing service...
curl -s -X GET "https://api.render.com/v1/services?type=web&name=axion-planetary-mcp&limit=1" -H "Authorization: Bearer %RENDER_API_KEY%" -H "Accept: application/json" > temp_check.json

findstr /C:"srv-" temp_check.json >nul
if %errorlevel%==0 (
    echo Service exists. Please deploy manually via dashboard.
    echo.
    echo 1. Go to: https://dashboard.render.com
    echo 2. Find your axion-planetary-mcp service
    echo 3. Go to Environment tab
    echo 4. Add GOOGLE_APPLICATION_CREDENTIALS_JSON with your key
    echo 5. Trigger manual deploy
) else (
    echo Creating new service...
    echo Please use the Render Dashboard to create the service:
    echo.
    echo URL: https://dashboard.render.com/create/web
    echo.
    echo Settings:
    echo - Repo: https://github.com/Dhenenjay/axion-planetary-mcp  
    echo - Branch: master
    echo - Build: npm install ^&^& npm run build:next
    echo - Start: npm run start:prod
    echo - Region: Oregon
)

del temp_check.json 2>nul

echo.
echo Service URL will be: https://axion-planetary-mcp.onrender.com
echo.
pause