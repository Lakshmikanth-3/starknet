#!/bin/bash
echo "🚀 Deploying MockBTC to Devnet..."

# Load environment
source ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"

# Go to project root
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Define Tools
SCARB="/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb"
SNCAST="/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast"

# Check if devnet is alive (using a proper JSON-RPC call)
if ! curl -s -d '{"jsonrpc":"2.0","method":"starknet_chainId","params":[],"id":1}' -H "Content-Type: application/json" http://127.0.0.1:5050 > /dev/null; then
    echo "❌ Error: starknet-devnet is not responding on http://127.0.0.1:5050"
    echo "Please ensure starknet-devnet is running."
    exit 1
fi

# 0. Build
echo "🔨 Building contracts..."
$SCARB build

# 1. Declare
echo "📝 Declaring MockBTC..."
# Use --output-format json for cleaner parsing
declare_res=$($SNCAST --profile devnet declare --contract-name MockBTC 2>&1)
echo "$declare_res"
# Use case-insensitive grep and handle multiple spaces
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

# 2. Get Account Address
# In your accounts.json, the account name is "0"
account_addr=$(grep -oP '"address": "\K0x[a-fA-F0-9]+' ../hello_starknet/accounts.json | head -n 1)
echo "👤 Account Address (Account '0'): $account_addr"

# 3. Deploy
echo "🚀 Deploying instance..."
deploy_res=$($SNCAST --profile devnet deploy --class-hash $class_hash --constructor-calldata $account_addr 2>&1)
echo "$deploy_res"
contract_addr=$(echo "$deploy_res" | grep -oiP 'Contract address:\s+\K0x[a-fA-F0-9]+' || echo "$deploy_res" | grep -oiP 'contract_address:\s+\K0x[a-fA-F0-9]+' || echo "$deploy_res" | grep -oP '"contract_address":\s*"\K0x[a-fA-F0-9]+')

if [ -z "$contract_addr" ]; then
    echo "❌ Deployment failed."
    exit 1
fi
echo "✅ MockBTC deployed at: $contract_addr"

# Save for later
echo "export MOCK_BTC_ADDR=$contract_addr" > deploy_info.sh
