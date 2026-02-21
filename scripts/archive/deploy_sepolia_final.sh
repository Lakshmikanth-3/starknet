#!/bin/bash

# FINAL SOLUTION: Use your actual Sepolia account
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🔧 Setting up Sepolia account for deployment..."
echo ""

# Remove old keystore and create new one with correct Sepolia private key
rm -f ~/.starkli-wallets/deployer/keystore.json

# Create keystore with your Sepolia account private key
KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
PRIVATE_KEY="0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48"
PASSWORD="12345678"

mkdir -p ~/.starkli-wallets/deployer

# Create keystore - will ask for private key and password
printf "%s\n%s\n%s\n" "$PRIVATE_KEY" "$PASSWORD" "$PASSWORD" | starkli signer keystore from-key "$KEYSTORE_PATH"

echo "✅ Keystore created with Sepolia account"
echo ""

# Create account file with correct Sepolia account
ACCOUNT_PATH="$HOME/.starkli-wallets/deployer/account.json"
cat > "$ACCOUNT_PATH" << 'EOF'
{
  "version": 1,
  "variant": {
    "type": "open_zeppelin",
    "version": 1,
    "public_key": "0x9703eafeb58adbbd88c27b96962fff1812f27ee9e25a48751b0978cf2e6223"
  },
  "deployment": {
    "status": "deployed",
    "class_hash": "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f",
    "address": "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b"
  }
}
EOF

echo "✅ Account configured for Sepolia"
echo ""

# Build
echo "📦 Building..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Declare MockBTC
echo "📝 Declaring MockBTC to Sepolia..."
starkli declare \
  --rpc https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ \
  --account "$ACCOUNT_PATH" \
  --keystore "$KEYSTORE_PATH" \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ Declaration complete! Copy the class hash above."
