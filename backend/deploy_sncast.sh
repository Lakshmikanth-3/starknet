#!/bin/bash
set -e

RPC_URL="http://127.0.0.1:5060"
ACCOUNT="my_deployer_2"

echo "🚀 Deploying with sncast (WSL)..."

parse_json() {
    python3 -c "import sys, json; print(json.load(sys.stdin)['$1'])"
}

# 1. Deploy Account
echo "👤 Deploying account '$ACCOUNT'..."
# Check if already deployed? sncast might fail if already deployed.
# We try to deploy, if it fails we continue (assuming likely already deployed or funds issue dealt with)
# But sncast error for "already deployed" might differ.
# Let's just run it and catch error.
set +e
DEPLOY_ACC_OUT=$(~/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --json account deploy --name "$ACCOUNT" --url "$RPC_URL" --max-fee 100000000000000 2>&1)
RES=$?
set -e

if [ $RES -eq 0 ]; then
    TX_HASH=$(echo "$DEPLOY_ACC_OUT" | parse_json "transaction_hash")
    echo "✅ Account deployed. Tx: $TX_HASH"
else
    echo "⚠️ Account deployment failed (maybe already deployed?):"
    echo "$DEPLOY_ACC_OUT"
fi

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "---------------------------------------------------"
echo "👉 Step 1: Deploying MockBTC"

echo "📋 Declaring MockBTC..."
# sncast declare --contract-name MockBTC --package private_btc_core
DEC_MOCK_OUT=$(~/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --json declare --contract-name MockBTC --package private_btc_core --url "$RPC_URL" --account "$ACCOUNT" 2>&1)
echo "Debug Declare Output: $DEC_MOCK_OUT"

MOCK_CLASS_HASH=$(echo "$DEC_MOCK_OUT" | parse_json "class_hash")
echo "✅ MockBTC Class Hash: $MOCK_CLASS_HASH"

echo "🚢 Deploying MockBTC..."
ACCOUNT_ADDRESS=$(grep -A 10 "$ACCOUNT" ~/.starknet_accounts/starknet_open_zeppelin_accounts.json | grep "address" | cut -d '"' -f 4)
echo "Using recipient: $ACCOUNT_ADDRESS"

DEP_MOCK_OUT=$(~/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --json deploy --class-hash "$MOCK_CLASS_HASH" --constructor-calldata "$ACCOUNT_ADDRESS" --url "$RPC_URL" --account "$ACCOUNT" 2>&1)
MOCK_ADDRESS=$(echo "$DEP_MOCK_OUT" | parse_json "contract_address")
echo "✅ MockBTC Address: $MOCK_ADDRESS"

echo "---------------------------------------------------"
echo "👉 Step 2: Deploying PrivateBTCVault"

echo "📋 Declaring PrivateBTCVault..."
# Note: Contract name in Scarb might be PrivateBTCVault or PrivateBTC. Using PrivateBTC based on file name earlier.
# But file was private_btc_core_PrivateBTC.contract_class.json.
# Let's try PrivateBTCVault, if fail try PrivateBTC.
set +e
DEC_VAULT_OUT=$(~/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --json declare --contract-name PrivateBTCVault --package private_btc_core --url "$RPC_URL" --account "$ACCOUNT" 2>&1)
if [ $? -ne 0 ]; then
    echo "⚠️ PrivateBTCVault declare failed, trying PrivateBTC..."
    DEC_VAULT_OUT=$(~/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --json declare --contract-name PrivateBTC --package private_btc_core --url "$RPC_URL" --account "$ACCOUNT" 2>&1)
fi
set -e
echo "Debug Declare Output: $DEC_VAULT_OUT"

VAULT_CLASS_HASH=$(echo "$DEC_VAULT_OUT" | parse_json "class_hash")
echo "✅ Vault Class Hash: $VAULT_CLASS_HASH"

echo "🚢 Deploying Vault..."
# Constructor: btc_token (MOCK_ADDRESS)
DEP_VAULT_OUT=$(~/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --json deploy --class-hash "$VAULT_CLASS_HASH" --constructor-calldata "$MOCK_ADDRESS" --url "$RPC_URL" --account "$ACCOUNT" 2>&1)
VAULT_ADDRESS=$(echo "$DEP_VAULT_OUT" | parse_json "contract_address")
echo "✅ Vault Address: $VAULT_ADDRESS"

echo "---------------------------------------------------"
echo "💾 Saving deployment info..."

OUTPUT_FILE="../privatebtc-backend/deployment-info.json"
cat > "$OUTPUT_FILE" <<EOF
{
  "network": "devnet-local",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "MockBTC": {
      "classHash": "$MOCK_CLASS_HASH",
      "address": "$MOCK_ADDRESS"
    },
    "PrivateBTCVault": {
      "classHash": "$VAULT_CLASS_HASH",
      "address": "$VAULT_ADDRESS"
    }
  }
}
EOF

echo "🎉 Deployment Complete!"
