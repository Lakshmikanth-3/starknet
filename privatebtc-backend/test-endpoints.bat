@echo off
echo.
echo ===================================
echo Testing PrivateBTC Backend
echo ===================================
echo.

echo [1/6] Testing Health Check...
curl http://localhost:3001/health
echo.
echo.

echo [2/6] Creating Test Vault...
curl -X POST http://localhost:3001/api/vaults -H "Content-Type: application/json" -d "{\"userAddress\":\"0xtest123\",\"amount\":1.5,\"lockPeriod\":90}"
echo.
echo.

echo [3/6] Getting User Vaults...
curl http://localhost:3001/api/vaults/0xtest123
echo.
echo.

echo [4/6] Getting Platform Stats...
curl http://localhost:3001/api/stats
echo.
echo.

echo [5/6] Testing Invalid Route (should return 404)...
curl http://localhost:3001/api/invalid
echo.
echo.

echo [6/6] Testing Generate Proof (will fail without real data)...
curl -X POST http://localhost:3001/api/vaults/generate-proof -H "Content-Type: application/json" -d "{\"vaultId\":\"test\",\"amount\":1.5,\"randomness\":\"abc123\"}"
echo.
echo.

echo ===================================
echo Tests Complete!
echo ===================================
