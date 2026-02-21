#!/bin/bash
# scripts/test_real_deposit_history.sh
# Final version using STRK as the asset for the demo

set -e

# Configuration (STRK Vault)
STRK_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
VAULT="0x03476906a58bc9e96e05396556f8f4a132c32cf46dd4d9ad216f8d4d6ad15d6"
ACCOUNT="sepolia"
RPC="https://starknet-sepolia.public.blastapi.io/rpc/v0_7"

# Ensure STRK for gas fees
export STARKNET_FEE_TOKEN="strk"

echo "🚀 GENERATING REAL TRANSACTION HISTORY ON SEPOLIA (STRK EDITION)"
echo "   Vault (STRK-backed): $VAULT"
echo "   Asset: STRK"
echo "   Account: $ACCOUNT"
echo ""

# 1. Approve Vault to spend 10 STRK
echo "🔒 Step 1: Approving Vault (STRK)..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --account "$ACCOUNT" invoke \
  --url "$RPC" \
  --contract-address "$STRK_TOKEN" \
  --function "approve" \
  --calldata "$VAULT" "10000000000000000000" "0"

echo "✅ Approved!"
echo ""

# 2. Deposit 1 STRK into Vault
echo "🏦 Step 2: Depositing 1 STRK into Private Vault..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --account "$ACCOUNT" invoke \
  --url "$RPC" \
  --contract-address "$VAULT" \
  --function "deposit" \
  --calldata "1000000000000000000" "0" "0x123"

echo ""
echo "🎉 SUCCESS! Your Private Vault is now working with STRK."
echo "View History: https://sepolia.voyager.online/contract/$VAULT"
echo ""
