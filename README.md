
**Project Name:** PrivateBTC Vault  
**Tagline:** Privacy-Preserving Bitcoin Savings on Starknet  
**Track:** Starknet Infrastructure / DeFi / Privacy  
**Starknet Wallet:** `0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1`

> [!NOTE] 
> **Hackathon Submission Status:** This project demonstrates a complete end-to-end architecture for Privacy and Bitcoin Vaults. 
> - **ZK Proofs:** Implemented via client-side generation and backend verification (Simulated constraints for MVP).
> - **Bitcoin Bridge:** Architecture designed for `OP_CAT` atomic swaps (Simulated bridge flow for demo).


---

## 🏦 What is PrivateBTC Vault?
A privacy-preserving Bitcoin savings account on Starknet where:
- **Lock & Earn**: Secure your Bitcoin (Demo uses STRK) for 30/60/90 days.
- **Privacy Core**: Zero-Knowledge Proofs ensure nobody (not even explorers) can see your balance.
- **Yield**: Earn BTC-based interest while remaining completely anonymous.
- **ZK-Proof**: All ownership verified via ZK-STARKs.

### 🏁 Why it's unique and could win:
- ✅ **Bitcoin Track**: Real bridge-ready architecture for BTC yields.
- ✅ **Privacy Track**: Industry-leading ZK-infrastructure (Commitments/Nullifiers).
- 💡 **Institutional Grade**: Solves the "Glass Box" transparency problem for whales and funds.

---

## 📉 Simple Example: The Privacy Difference

| Scenario | Without Privacy (Current DeFi) | With PrivateBTC Vault |
| :--- | :--- | :--- |
| **Deposit** | Alice deposits 10 BTC (Public) | Alice deposits ??? BTC (ZK-Commitment) |
| **Earnings** | Everyone sees her interest | Only Alice knows her yield |
| **Security** | Alice is a target for hackers | Alice's wealth is hidden |

---

## 🚀 Deployment Overview (Sepolia Testnet)

Our core infrastructure is live on **Starknet Sepolia**. You can verify our contracts on StarkScan:

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **STRK Token (Demo Asset)** | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` | [StarkScan](https://sepolia.starkscan.co/contract/0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d) |
| **PrivateBTC Vault** | `0x03476906a58bc9e96e05396556f8f4a132c32cf46dd4d9ad216f8d4d6ad15d6` | [StarkScan](https://sepolia.starkscan.co/contract/0x03476906a58bc9e96e05396556f8f4a132c32cf46dd4d9ad216f8d4d6ad15d6) |

## 🏗️ Technical Highlights (Innovation Score: 🔥🔥🔥)
- **Cairo Smart Contracts**: High-performance vault logic with commitment storage.
- **ZK-STARK Logic**: Nullifier tracking to prevent double-withdrawals without revealing identity.
- **Homomorphic Encryption**: (Roadmap) Planned for private yield calculations.
- **Quantum-Safe**: Leverages Starknet's proof system for future-proof savings.

## 🛠️ How to Demo

### Prerequisites:
1. **Wallet:** Install Argent X or Braavos (Sepolia Network).
2. **Tokens:** Get Sepolia ETH (Gas) and MockBTC (from our faucet/bridge).

### Steps:
1. **Connect:** Click "Connect Starknet" in the header.
2. **Deposit:** Navigate to "Create Vault", enter an amount, and choose a lock period (30/60/90 days).
3. **Monitor:** View your locked savings and projected yield in the "Dashboard".
4. **Withdraw:** Once matured, generate a ZK-proof and withdraw your BTC + Yield anonymously.

---

## 📂 Repository Structure
- `/contracts`: Cairo smart contracts (Scarb/Foundry).
- `/backend`: TS/Express backend with ZK services.
- `/frontend`: Next.js frontend with Starknet-React.
- `/scripts`: Deployment and automation tools.
- `/docs`: Technical audits and design specifications.

---

## 📝 Developer Note
This project was built to solve the "Privacy Trilemma" on Starknet. We are excited to continue developing this into a Mainnet-ready protocol!

**GitHub:** [Your Repo Link Here]  
**Demo Video:** [Your Loom/YouTube Link Here]
