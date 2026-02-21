@echo off
REM Quick test scripts using curl (alternative to PowerShell scripts)

echo.
echo ===================================
echo PrivateBTC Backend - Quick Tests
echo ===================================
echo.

:menu
echo Choose a test:
echo.
echo 1. Health Check
echo 2. Create Vault
echo 3. Get User Vaults  
echo 4. Platform Stats
echo 5. Run All Tests
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto health
if "%choice%"=="2" goto create
if "%choice%"=="3" goto getvaults
if "%choice%"=="4" goto stats
if "%choice%"=="5" goto all
if "%choice%"=="6" goto end

:health
echo.
echo [Testing Health Check]
curl -s http://localhost:3001/health | jq .
echo.
pause
goto menu

:create
echo.
echo [Creating Vault]
curl -s -X POST http://localhost:3001/api/vaults -H "Content-Type: application/json" -d "{\"userAddress\":\"0xtest123\",\"amount\":1.5,\"lockPeriod\":90}" | jq .
echo.
pause
goto menu

:getvaults
echo.
set /p addr="Enter user address (default: 0xtest123): "
if "%addr%"=="" set addr=0xtest123
echo.
echo [Getting vaults for %addr%]
curl -s http://localhost:3001/api/vaults/%addr% | jq .
echo.
pause
goto menu

:stats
echo.
echo [Platform Statistics]
curl -s http://localhost:3001/api/stats | jq .
echo.
pause
goto menu

:all
echo.  
echo [1/4] Health Check...
curl -s http://localhost:3001/health | jq .
timeout /t 2 >nul
echo.

echo [2/4] Creating Vault...
curl -s -X POST http://localhost:3001/api/vaults -H "Content-Type: application/json" -d "{\"userAddress\":\"0xtest999\",\"amount\":2.0,\"lockPeriod\":90}" | jq .
timeout /t 2 >nul
echo.

echo [3/4] Getting Vaults...
curl -s http://localhost:3001/api/vaults/0xtest999 | jq .
timeout /t 2 >nul
echo.

echo [4/4] Platform Stats...
curl -s http://localhost:3001/api/stats | jq .
echo.

echo All tests complete!
pause
goto menu

:end
echo.
echo Goodbye!
exit /b
