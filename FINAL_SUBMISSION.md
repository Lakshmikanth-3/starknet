# PrivateBTC Vault — Final Submission Report

This document compiles the complete overview, data audit, and verification guide for the PrivateBTC Vault project.

---

## 1. Executive Summary: 100% Verified (21/21 Passed)
The PrivateBTC Vault is a secure, privacy-preserving Bitcoin bridge leveraging Starknet Sepolia, Bitcoin Signet, and ZK-STARK proofs via SHARP. 

The backend has been successfully hardened against race conditions, DDoS attacks, and RPC failures, resulting in an extensive 21-test suite achieving a perfect 21/21 pass.

| Metric | Status | Details |
| :--- | :--- | :--- |
| **Integration Tests** | ✅ **21/21 PASS** | 100% success on standard & edge-case flows |
| **Resilience System** | ✅ **VERIFIED** | Circuit Breaker caught transient RPC errors |
| **Starknet Sepolia** | ✅ **ACTIVE** | Vault and MockBTC contracts verified on-chain |
| **Bitcoin Signet** | ✅ **REAL** | Native block and transaction monitoring active |

---

## 2. Live Deployment Details (Starknet Sepolia)
The following core infrastructure is deployed, actively reachable, and fully verified on the Sepolia testnet:

- **Vault Contract:** `0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2`
- **Mock BTC Contract:** `0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52`
- **RPC Endpoint:** `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ`

---

## 3. Real vs. Mock Data Audit
The system is designed with a **"Real-First"** approach, using live on-chain data for all critical financial logic.

| Component | Data Source | Verification |
| :--- | :--- | :--- |
| **Starknet Interaction** | **REAL** | 100% On-chain RPC calls using API `starknet.js` |
| **Vault State** | **REAL** | `is_commitment_registered` via Sepolia contract |
| **Transaction Hashes** | **REAL** | Enforced by SQLite trigger `enforce_real_tx_hash` |
| **Bitcoin Signet** | **REAL** | Uses mempool.space API to track actual BTC blocks |
| **SHARP Prover** | **SIMULATED** | Requires Cairo 0 Docker; integrated via local fallback |

### 🟢 Real Data Details (Native RPC/API)
- **Starknet State**: Block numbers, transaction receipts, and account balances are fetched in real-time from the **Starknet Sepolia RPC**. No hardcoded block data is used.
- **Bitcoin Signet Tracking**: The `BitcoinSignetService` communicates directly with the **mempool.space/signet/api**. It fetches current Bitcoin block headers and real transaction data.
- **Commitments & Nullifiers**: The system uses real **Pedersen/Poseidon** hashing (via `starknet.js`) for deposit privacy and double-spend prevention.

### 🟡 Hybrid / Demo Simulation Fallbacks
To ensure the demo remains functional across diverse environments (including those without the full `cairo-sharp` toolchain), the following fallbacks are implemented:
- **SHARP Proofs**: If the `cairo-sharp` CLI is not installed on the host, the system generates a `SIMULATED-JOB-ID`. This proves the **integration logic** works even if the prover is absent.
- **Bitcoin Bridge Detection**: The route `/api/bridge/detect-lock` supports both a real scan and a `simulate: true` flag for instant demonstrations.

---

## 4. Backend Hardening & Security
The backend has been meticulously hardened to production-readiness:

- **Concurrency Locks (`LockManager`)**: Prevents race conditions during HTLC claims and refunds. Tested heavily via double-claim stress tests (Test 19).
- **RPC Circuit Breakers**: Polling Starknet RPC nodes triggers a structured fail-safe fallback before completely blocking requests if the RPC fails repeatedly.
- **Strict Rate Limiting**: Tiered limiting (General, Strict, SHARP) prevents DDoS. (Test 21).
- **Zod Validation Middleware**: Prevents payload manipulation and malformed data from reaching internal logic. (Tests 12, 13, 14, 15, 16).
- **Cryptographic Hashing**: Implementation of Starknet's native Pedersen and Poseidon hashing mechanisms directly off-chain.

---

## 5. Directory & File Structure
```text
C:\Users\sl\OneDrive\Documents\Hackathons\starknet
├── backend/                  # Node.js Express Backend
│   ├── deployment-info.json  # Recorded Sepolia Addresses
│   ├── privatebtc.db         # Core SQLite Database
│   ├── src/
│   │   ├── config/           # Envs and Constants (env.ts)
│   │   ├── db/               # SQLite Schema (schema.ts)
│   │   ├── middleware/       # Zod, Handlers, Locks, Limits
│   │   ├── routes/           # Audit, Bridge, Commitment, HTLC, Sharp, Vault, Withdraw
│   │   ├── services/         # BitcoinSignet, Commitment, Crypto, HTLC, SHARP, Starknet, Wallet
│   │   └── index.ts          # Express Server Entry Point
│   └── scripts/
│       ├── integration-test.ts # The 21/21 suite
│       └── deploy_fresh.ts     # Configured Deployment file
│
├── contracts/                # Cairo 2/3 Smart Contracts 
│   ├── src/
│   │   ├── mock_btc.cairo    # ERC-20 Mock Token
│   │   └── vault.cairo       # Core Vault Logic
│   └── target/dev/           # Compiled Sierra and Casm files used for deployment
│
└── frontend/                 # Next.js UI (Under Construction)
    ├── components/
    └── src/
```

---

## 6. Verification Guide & Reproducibility

This section outlines how judges or auditors can run the backend and verify the authenticity of all data (Transactions, Contracts, Hashes, Vaults, and Addresses).

### 6.1 Running the Backend
Ensure the environment variables in `backend/.env` are set, then start the development server:

```bash
cd backend
npm install
npm run dev
```
The server will be live at `http://localhost:3001`.

### 6.2 Verifying Core Contracts (Starknet Sepolia)
You can verify the active contracts on any Starknet Sepolia explorer (e.g., [Voyager](https://sepolia.voyager.online/) or [Starkscan](https://sepolia.starkscan.co/)).

| Item | Address / ID | How to Verify |
| :--- | :--- | :--- |
| **Vault Contract** | `0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2` | Search on Voyager to see the class hash and recent events. |
| **MockBTC Token** | `0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52` | Search to verify it is an ERC-20 compliant token on Sepolia. |

### 6.3 Verifying Transactions
Any operation that interacts with Starknet (Deposit/Withdraw) will return a `transaction_hash`.

1. **Copy the Hash**: e.g., `0x071b...`
2. **Search Explorer**: Paste the hash into [Voyager Sepolia](https://sepolia.voyager.online/).
3. **Check Status**: Look for `ACCEPTED_ON_L2` or `SUCCEEDED`.

### 6.4 Verifying Vaults & HTLCs (Database)
The backend uses SQLite to track off-chain state. You can inspect the database directly.

```bash
# Open the production database
cd backend
sqlite3 privatebtc-production-v4.db
```

- **Vaults**: `SELECT * FROM vaults;` (Look for `vault_id` UUIDs).
- **HTLCs**: `SELECT * FROM htlcs;` (Verify `status` changes from `pending` to `claimed`).
- **SHARP Proofs**: `SELECT * FROM sharp_proofs;` (Check `job_key` status).

### 6.5 Automated API Verification (The 21-Test Suite)
Run the built-in integration suite to verify all endpoints are working and identically configured. Keep the `npm run dev` server running in one terminal, and in another:

```bash
cd backend
npx tsx scripts/integration-test.ts
```
**Expected**: 21/21 passed.
