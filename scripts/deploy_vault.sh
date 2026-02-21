#!/bin/bash
echo "🚀 Deploying PrivateBTCVault to Devnet..."

# Load environment
source ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"

# Go to project root
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Check if MockBTC address is provided
if [ -z "$1" ]; then
    echo "❌ Error: MockBTC address required."
    echo "Usage: ./deploy_vault.sh <MOCK_BTC_ADDRESS>"
    exit 1
fi

MOCK_BTC_ADDR=$1

# Define Tools
SCARB="/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb"
SNCAST="/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast"

# 0. Build (Already built by mock deploy, but safe to repeat)
echo "🔨 Building contracts..."
$SCARB build

# 1. Declare
echo "📝 Declaring Vault..."
declare_res=$($SNCAST --profile devnet declare --contract-name PrivateBTCVault 2>&1)
echo "$declare_res"
class_hash=$(echo "$declare_res" | grep -oiP 'Class Hash:\s+\K0x[a-fA-F0-9]+' || echo "$declare_res" | grep -oiP 'class_hash:\s+\K0x[a-fA-F0-9]+' || echo "$declare_res" | grep -oP '"class_hash":\s*"\K0x[a-fA-F0-9]+')

if [ -z "$class_hash" ]; then
    # Check if it was already declared and extract hash from error
    if echo "$declare_res" | grep -q "already declared"; then
        class_hash=$(echo "$declare_res" | grep -oiP 'class hash\s+\K0x[a-fA-F0-9]+')
        echo "ℹ️ Contract already declared. Using existing Class Hash."
    else
        echo "❌ Declaration failed."
        exit 1
    fi
fi
echo "✅ Class Hash: $class_hash"

# 2. Deploy
echo "🚀 Deploying instance (linking to MockBTC at $MOCK_BTC_ADDR)..."
deploy_res=$($SNCAST --profile devnet deploy --class-hash $class_hash --constructor-calldata $MOCK_BTC_ADDR 2>&1)
echo "$deploy_res"
vault_addr=$(echo "$deploy_res" | grep -oiP 'Contract address:\s+\K0x[a-fA-F0-9]+' || echo "$deploy_res" | grep -oiP 'contract_address:\s+\K0x[a-fA-F0-9]+' || echo "$deploy_res" | grep -oP '"contract_address":\s*"\K0x[a-fA-F0-9]+')

if [ -z "$vault_addr" ]; then
    echo "❌ Deployment failed."
    exit 1
fi
echo "✅ PrivateBTCVault deployed at: $vault_addr"

# Save for later
echo "export VAULT_ADDR=$vault_addr" >> deploy_info.sh
