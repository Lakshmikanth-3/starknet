#!/bin/bash

# Alternative: Use starkli step-by-step
# This avoids the keystore creation issue in the original script

set -e

RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ"
ACCOUNT_FILE="/home/sl/.starknet_accounts/starknet_open_zeppelin_accounts.json"
CONTRACT_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core"

cd "$CONTRACT_DIR"

echo "🚀 Deploying with starkli - Step by Step"
echo ""

# Check if account file exists
if [ ! -f "$ACCOUNT_FILE" ]; then
    echo "❌ Account file not found: $ACCOUNT_FILE"
    echo "Please create your account file first or specify the correct path"
    exit 1
fi

echo "📝 Declaring MockBTC..."
starkli declare \
  --rpc "$RPC_URL" \
  --account "$ACCOUNT_FILE" \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "Copy the class hash from above and run:"
echo ""
echo "starkli deploy --rpc '$RPC_URL' --account '$ACCOUNT_FILE' <CLASS_HASH> 0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b"
