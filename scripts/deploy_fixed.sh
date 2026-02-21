#!/bin/bash

# FIXED: Non-interactive keystore creation
set -e

echo "🔧 Setting up starkli deployment..."
echo ""

# Install starkliup if not already installed
if ! command -v starkliup &> /dev/null; then
    echo "Installing starkliup..."
    curl https://get.starkli.sh | sh
    source ~/.starkli/env
fi

# Install latest starkli
echo "Installing/updating starkli..."
starkliup

# Navigate to project directory
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Build contracts
echo ""
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Create keystore directory
KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
mkdir -p "$HOME/.starkli-wallets/deployer"

# Create keystore non-interactively by piping both password and private key
PRIVATE_KEY="0x71d7bb07b9a64f6f78ac4c816aff4da9"
PASSWORD="12345678"

# Use printf to pipe private key, then password
printf "%s\n%s\n%s\n" "$PRIVATE_KEY" "$PASSWORD" "$PASSWORD" | starkli signer keystore from-key "$KEYSTORE_PATH"

echo "✅ Keystore created"
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

echo "✅ Account configured"
echo ""

# Declare MockBTC
RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ"

echo "📝 Declaring MockBTC..."
export STARKNET_KEYSTORE="$KEYSTORE_PATH"
echo "$PASSWORD" | starkli declare \
  --rpc "$RPC_URL" \
  --account "$ACCOUNT_PATH" \
  --keystore "$KEYSTORE_PATH" \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ Declaration complete! Copy the class hash above to deploy."
