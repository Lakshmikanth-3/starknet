# Bitcoin OP_CAT Bridge Architecture

This document outlines the theoretical design and implementation path for the Bitcoin Bridge component of **PrivateBTC Vault**. While the current demo uses a simulated bridge, the final protocol leverages the proposed `OP_CAT` opcode on Bitcoin (BIP-347) to enable trust-minimized bridging.

## 1. Overview

The bridge allows users to lock native BTC on the Bitcoin network and mint a wrapped representation (PrivateBTC) on Starknet. The unique innovation here is using `OP_CAT` to enforce covenant logic directly on Bitcoin, removing the need for a centralized custodian.

## 2. The Role of OP_CAT

`OP_CAT` (Concatenate) allows Bitcoin Script to concatenate two stack elements. This seemingly simple operation enables **Covenants**—scripts that can enforce conditions on the *spending transaction* itself.

### Mechanism:
1.  **Vault Creation:** User sends BTC to a Taproot address controlled by a script that uses `OP_CAT`.
2.  **State Introspection:** The script reconstructs the transaction data and verifies that the output (where the BTC is going) matches specific rules.
3.  **Atomic Swap:** The script ensures that BTC can only be moved if a corresponding proof of burn or lock is provided on Starknet.

## 3. Bridge Flow

### Deposit (BTC -> Starknet)
1.  User generates a `DepositKey` and `StarknetAddress`.
2.  User sends BTC to the **Bridge Covenent Address** with `StarknetAddress` embedded in the OP_RETURN or Witness data.
3.  **Starknet Sequencer** observes the Bitcoin transaction.
4.  After 6 confirmations, the Sequencer mints `PrivateBTC` to the `StarknetAddress`.

### Withdrawal (Starknet -> BTC)
1.  User initiates withdrawal on Starknet, burning `PrivateBTC` and providing a bitcoin `WithdrawalAddress`.
2.  The Starknet sequencer publishes a **Batch Withdrawal Proof**.
3.  **Relayers** submit this proof to the Bitcoin network.
4.  The Bitcoin Covenant Script (using `OP_CAT`) verifies the proof (Merkle Root of the batch) and releases BTC to the `WithdrawalAddresses`.

## 4. Security Model

- **Trust-Minimized:** Unlike MultiSig bridges, the security relies on Bitcoin's consensus rules and the correctness of the Starknet OS.
- **Fraud Proofs:** If the Sequencer behaves maliciously (e.g., minting without locking BTC), a fraud proof can be submitted to slash the Sequencer's stake.
- **Privacy:** All Starknet-side operations (minting, burning) happen within the ZK-circuit of the PrivateBTC Vault, ensuring the link between the BTC deposit and the Starknet user is broken.

## 5. Roadmap to Production

1.  **Phase 1 (Current):** Trusted Relayer (Simulated Bridge).
2.  **Phase 2:** MultiSig Federation (MPC).
3.  **Phase 3:** `OP_CAT` Activation on Bitcoin Signet/Mainnet -> Full Trust-Minimized Bridge.
