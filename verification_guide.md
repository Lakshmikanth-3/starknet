# Verification Guide: PrivateBTC Vault

This guide provides instructions on how to run the backend and verify the authenticity of all data (Transactions, Contracts, Hashes, Vaults, and Addresses).

## 1. Running the Backend
Ensure the environment variables in `.env` are set, then start the development server:

```bash
cd backend
npm install
npm run dev
```
The server will be live at `http://localhost:3001`.

## 2. Verifying Core Contracts (Starknet Sepolia)
You can verify the active contracts on any Starknet Sepolia explorer (e.g., [Voyager](https://sepolia.voyager.online/) or [Starkscan](https://sepolia.starkscan.co/)).

| Item | Address / ID | How to Verify |
| :--- | :--- | :--- |
| **Vault Contract** | `0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2` | Search on Voyager to see the class hash and recent events. |
| **MockBTC Token** | `0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52` | Search to verify it is an ERC-20 compliant token on Sepolia. |

## 3. Verifying Transactions
Any operation that interacts with Starknet (Deposit/Withdraw) will return a `transaction_hash`.

1. **Copy the Hash**: e.g., `0x071b...`
2. **Search Explorer**: Paste the hash into [Voyager Sepolia](https://sepolia.voyager.online/).
3. **Check Status**: Look for `ACCEPTED_ON_L2` or `SUCCEEDED`.

## 4. Verifying Vaults & HTLCs (Database)
The backend uses SQLite to track off-chain state. You can inspect the database directly.

```bash
# Open the production database
sqlite3 privatebtc-production-v4.db
```

- **Vaults**: `SELECT * FROM vaults;` (Look for `vault_id` UUIDs).
- **HTLCs**: `SELECT * FROM htlcs;` (Verify `status` changes from `pending` to `claimed`).
- **SHARP Proofs**: `SELECT * FROM sharp_proofs;` (Check `job_key` status).

## 5. Verifying Cryptographic Hashes
- **Commitments**: The `commitment` (Pedersen) and `nullifier_hash` (Poseidon) are generated using `starknet.js`.
- **HTLC Hashlocks**: HTLCs use Poseidon hashes. You can verify a claim by checking if `Poseidon(preimage) == hashlock`.

## 6. Automated API Verification
Run the built-in integration suite to verify all endpoints are working and hardened:

```bash
npx tsx scripts/integration-test.ts
```
Expected: **21/21 passed**.
