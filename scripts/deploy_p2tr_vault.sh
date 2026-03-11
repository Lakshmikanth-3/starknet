#!/bin/bash
# Deploy vault.cairo v2 — P2TR covenant deposit address
# Tweaked pubkey from: tb1p72dtm26yw6ez0dzddqxt50960r7nyrw2dh0622u2zkp33qskqyaqrj90m7
# W0..W7 = 8 × u32 big-endian words of the 32-byte bech32m witness program

set -e

RPC="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ"
ACCOUNT_ADDR="0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1"
PRIVATE_KEY="0x06a45dc773c07770a783ccd7305ba630f9aeb808695e7fce522a747b102d78c6"

# Existing deployed contracts (reuse — no need to redeploy MockBTC or HeaderStore)
MOCK_BTC="0x0201c23ba72660516c987e8d11b8f6238b386f13099880cd1a8f5b065667343"
HEADER_STORE="0x47e0387bab4770af7bc402d5a798b0115e08a354727248f53184d86bd5a0c6a"

# 8 x u32 big-endian words of the covenant tweaked pubkey
# tb1p72dtm26yw6ez0dzddqxt50960r7nyrw2dh0622u2zkp33qskqyaqrj90m7
W0="0xf29abdab"
W1="0x4476b227"
W2="0xb44d680c"
W3="0xba3cba78"
W4="0xfd320dca"
W5="0x6ddfa52b"
W6="0x8a158318"
W7="0x8216013a"

cd /Users/khalid/Projects/PrivateBTC/contracts

echo "🔨 Building contracts..."
scarb build

echo ""
echo "📋 Declaring new PrivateBTCVault (P2TR version)..."
DECLARE_OUT=$(sncast \
  --url "$RPC" \
  --account "sepolia" \
  declare \
  --contract-name PrivateBTCVault 2>&1)

echo "$DECLARE_OUT"

# Extract class hash
VAULT_CLASS=$(echo "$DECLARE_OUT" | grep -oE 'class_hash: 0x[a-fA-F0-9]+' | awk '{print $2}' | head -1)

if [ -z "$VAULT_CLASS" ]; then
  # Maybe already declared — try to extract hash from error message
  VAULT_CLASS=$(echo "$DECLARE_OUT" | grep -oE '0x[a-fA-F0-9]{60,64}' | head -1)
fi

if [ -z "$VAULT_CLASS" ]; then
  echo "❌ Could not extract class hash. Output:"
  echo "$DECLARE_OUT"
  exit 1
fi

echo ""
echo "✅ Class hash: $VAULT_CLASS"
echo ""
echo "🚢 Deploying PrivateBTCVault with P2TR covenant tapkey..."
echo "   MOCK_BTC:      $MOCK_BTC"
echo "   HEADER_STORE:  $HEADER_STORE"
echo "   Tapkey W0..W7: $W0 $W1 $W2 $W3 $W4 $W5 $W6 $W7"
echo ""

DEPLOY_OUT=$(sncast \
  --url "$RPC" \
  --account "sepolia" \
  deploy \
  --class-hash "$VAULT_CLASS" \
  --constructor-calldata \
    "$MOCK_BTC" \
    "$HEADER_STORE" \
    "$W0" "$W1" "$W2" "$W3" "$W4" "$W5" "$W6" "$W7" 2>&1)

echo "$DEPLOY_OUT"

VAULT_ADDR=$(echo "$DEPLOY_OUT" | grep -oE 'contract_address: 0x[a-fA-F0-9]+' | awk '{print $2}' | head -1)

if [ -z "$VAULT_ADDR" ]; then
  VAULT_ADDR=$(echo "$DEPLOY_OUT" | grep -oE '0x[a-fA-F0-9]{60,64}' | head -1)
fi

if [ -z "$VAULT_ADDR" ]; then
  echo "❌ Could not extract contract address. Output above."
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ NEW VAULT (P2TR) DEPLOYED!"
echo "   Contract address: $VAULT_ADDR"
echo "   Explorer: https://sepolia.voyager.online/contract/$VAULT_ADDR"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📝 Update backend/.env with:"
echo "   VAULT_CONTRACT_ADDRESS=$VAULT_ADDR"
echo "   VAULT_ADDRESS=$VAULT_ADDR"
echo "   XVERSE_WALLET_ADDRESS=tb1p72dtm26yw6ez0dzddqxt50960r7nyrw2dh0622u2zkp33qskqyaqrj90m7"
echo "   VAULT_ADDRESS_BTC=tb1p72dtm26yw6ez0dzddqxt50960r7nyrw2dh0622u2zkp33qskqyaqrj90m7"
echo "   VAULT_BITCOIN_SCRIPT_PUBKEY=5120f29abdab4476b227b44d680cba3cba78fd320dca6ddfa52b8a1583188216013a"
echo "   # Remove old VAULT_PKH_W0..W4 lines (those were P2WPKH)"
echo "   VAULT_TAPKEY_W0=$W0"
echo "   VAULT_TAPKEY_W1=$W1"
echo "   VAULT_TAPKEY_W2=$W2"
echo "   VAULT_TAPKEY_W3=$W3"
echo "   VAULT_TAPKEY_W4=$W4"
echo "   VAULT_TAPKEY_W5=$W5"
echo "   VAULT_TAPKEY_W6=$W6"
echo "   VAULT_TAPKEY_W7=$W7"

# Write new address to a result file
cat > /Users/khalid/Projects/PrivateBTC/deploy_p2tr_vault.json <<EOF
{
  "network": "starknet-sepolia",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vault_p2tr": {
    "classHash": "$VAULT_CLASS",
    "address": "$VAULT_ADDR",
    "explorer": "https://sepolia.voyager.online/contract/$VAULT_ADDR"
  },
  "bitcoin": {
    "covenantAddress": "tb1p72dtm26yw6ez0dzddqxt50960r7nyrw2dh0622u2zkp33qskqyaqrj90m7",
    "scriptPubKey": "5120f29abdab4476b227b44d680cba3cba78fd320dca6ddfa52b8a1583188216013a",
    "tapkeyWords": ["$W0","$W1","$W2","$W3","$W4","$W5","$W6","$W7"]
  }
}
EOF
echo ""
echo "📄 Saved to deploy_p2tr_vault.json"
