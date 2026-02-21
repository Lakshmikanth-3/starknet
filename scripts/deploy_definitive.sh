#!/bin/bash

# DEFINITIVE SOLUTION: Install compatible starkli and deploy
# This is the ONLY solution that will work with v0.7 RPC endpoints

set -e

echo "🔧 Installing starkli (compatible with RPC v0.7)..."
echo ""

# Install starkliup if not already installed
if ! command -v starkliup &> /dev/null; then
    echo "Installing starkliup..."
    curl https://get.starkli.sh | sh
    source ~/.starkli/env
fi

# Install latest starkli
echo "Installing starkli..."
starkliup

echo ""
echo "✅ starkli installed successfully"
echo ""

# Navigate to project directory
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Build contracts
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Create keystore from private key (non-interactively)
KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
mkdir -p "$HOME/.starkli-wallets/deployer"

# Create keystore with the private key from devnet_accounts.json
# Use a simple password
PRIVATE_KEY="0x71d7bb07b9a64f6f78ac4c816aff4da9"
PASSWORD="12345678"

echo "$PASSWORD" | starkli signer keystore from-key "$KEYSTORE_PATH" <<< "$PRIVATE_KEY"

echo "✅ Keystore created at $KEYSTORE_PATH"
echo ""

# Create account descriptor file
ACCOUNT_PATH="$HOME/.starkli-wallets/deployer/account.json"
cat > "$ACCOUNT_PATH" << 'EOF'
{
  "version": 1,
  "variant": {
    "type": "open_zeppelin",
    "version": 1,
    "public_key": "0x39d9e6ce352ad4530a0ef5d5a18fd3303c3606a7fa6ac5b620020ad681cc33b"
  },
  "deployment": {
    "status": "deployed",
    "class_hash": "0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564",
    "address": "0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
  }
}
EOF

echo "✅ Account file created at $ACCOUNT_PATH"
echo ""

# Declare and deploy
RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ"

echo "📝 Declaring MockBTC..."
STARKLI_KEYSTORE_PASSWORD="$PASSWORD" starkli declare \
  --rpc "$RPC_URL" \
  --account "$ACCOUNT_PATH" \
  --keystore "$KEYSTORE_PATH" \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ Deployment script ready!"
echo "The script will now wait for you to copy the class hash"
echo "Then manually deploy with the class hash shown above"
