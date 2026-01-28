# 🔒 PrivateBTC Vault - Backend

Privacy-preserving Bitcoin savings protocol backend built for Starknet hackathon demo.

## 🎯 Features

- **Privacy-First**: Cryptographic commitments hide vault balances
- **ZK Proof Verification**: Simulated STARK proof system for withdrawals
- **Time-Locked Vaults**: Multiple lock periods (30, 60, 90, 180, 365 days)
- **Dynamic APY**: Higher yields for longer lock periods (6% - 18%)
- **Nullifier System**: Prevents double withdrawals
- **Full Audit Trail**: Transaction history tracking

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Server will start on **http://localhost:3001**

### 3. Build for Production

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Create Vault (Deposit)

```bash
POST /api/vaults
Content-Type: application/json

{
  "userAddress": "0x123abc...",
  "amount": 1.5,
  "lockPeriod": 90
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vaultId": "uuid-here",
    "commitment": "hash...",
    "randomness": "secret-randomness",
    "unlockAt": 1234567890,
    "apy": 0.12,
    "txHash": "0x...",
    "message": "Vault created successfully..."
  }
}
```

⚠️ **IMPORTANT**: Save the `randomness` value! You need it for withdrawal.

### Get User Vaults

```bash
GET /api/vaults/:userAddress
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "vaultId": "...",
      "commitment": "...",
      "lockPeriod": 90,
      "status": "locked",
      "apy": 0.12,
      "daysRemaining": 45,
      "amount": 1.5,
      "projectedYield": "0.04438356",
      "totalWithdrawal": "1.54438356"
    }
  ]
}
```

### Generate ZK Proof

```bash
POST /api/vaults/generate-proof
Content-Type: application/json

{
  "vaultId": "uuid-here",
  "amount": 1.5,
  "randomness": "your-saved-randomness"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "proof": "0x...",
    "publicInputs": ["vaultId", "amount"]
  }
}
```

### Withdraw from Vault

```bash
POST /api/vaults/:vaultId/withdraw
Content-Type: application/json

{
  "proof": "0x...",
  "userAddress": "0x123abc..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vaultId": "...",
    "principal": 1.5,
    "yield": "0.04438356",
    "totalAmount": "1.54438356",
    "txHash": "0x...",
    "message": "Withdrawal successful..."
  }
}
```

### Get Platform Statistics

```bash
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVaults": 10,
    "activeVaults": 7,
    "totalValueLocked": "15.50000000",
    "totalWithdrawals": 3
  }
}
```

## 🧪 Testing the Backend

### Test 1: Create a Vault

```bash
curl -X POST http://localhost:3001/api/vaults \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\":\"0xtest123\",\"amount\":1.5,\"lockPeriod\":90}"
```

### Test 2: Get Vaults for User

```bash
curl http://localhost:3001/api/vaults/0xtest123
```

### Test 3: Generate Proof

```bash
curl -X POST http://localhost:3001/api/vaults/generate-proof \
  -H "Content-Type: application/json" \
  -d "{\"vaultId\":\"YOUR_VAULT_ID\",\"amount\":1.5,\"randomness\":\"YOUR_RANDOMNESS\"}"
```

### Test 4: Withdraw (After Lock Period)

For testing, you can manually update the `unlock_at` timestamp in the database:

```sql
UPDATE vaults SET unlock_at = 0 WHERE vault_id = 'YOUR_VAULT_ID';
```

Then withdraw:

```bash
curl -X POST http://localhost:3001/api/vaults/YOUR_VAULT_ID/withdraw \
  -H "Content-Type: application/json" \
  -d "{\"proof\":\"0xYOUR_PROOF\",\"userAddress\":\"0xtest123\"}"
```

## 📊 APY Rates

| Lock Period | APY  |
|------------|------|
| 30 days    | 6%   |
| 60 days    | 9%   |
| 90 days    | 12%  |
| 180 days   | 15%  |
| 365 days   | 18%  |

## 🏗️ Project Structure

```
privatebtc-backend/
├── src/
│   ├── config/          # Database configuration
│   ├── controllers/     # API controllers
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   └── app.ts           # Main Express app
├── package.json
├── tsconfig.json
└── README.md
```

## 🔐 Security Notes

**FOR DEMO PURPOSES ONLY**

In production:
- Randomness should be client-side only
- Use real STARK proving system
- Encrypt sensitive data in database
- Add rate limiting
- Add authentication/authorization
- Use environment variables for secrets
- Add input sanitization
- Implement proper key management

## 🛠️ Tech Stack

- **Runtime**: Node.js v18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Crypto**: Node.js crypto module
- **Security**: Helmet, CORS

## 📝 License

MIT

## 🎉 Next Steps

1. ✅ Backend is ready!
2. 📱 Build frontend (React/Next.js)
3. 🔗 Connect wallet (Starknet)
4. 🚀 Deploy to production
5. 🎬 Create demo video

---

**Built for Starknet Hackathon** 🚀
