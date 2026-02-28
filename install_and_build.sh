#!/bin/bash
# Automated Scarb Installation and Contract Build Script

echo "=========================================="
echo "PrivateBTC - Automated Contract Build"
echo "=========================================="

# Check if Scarb is installed
if command -v scarb &> /dev/null; then
    echo "✓ Scarb is already installed"
    scarb --version
else
    echo "Installing Scarb via Starkup..."
    
    # Install Starkup
    curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh -s -- --yes
    
    # Source the environment
    source ~/.bashrc
    
    # Install Scarb
    starkup install scarb 2.8.2
    
    echo "✓ Scarb installed successfully"
fi

# Navigate to contracts directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/contracts" || exit 1

echo ""
echo "Cleaning old build artifacts..."
rm -rf target/

echo ""
echo "Building Cairo contracts..."
scarb build

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Build successful!"
    echo ""
    echo "Verifying ABIs..."
    
    # Check MockBTC ABI
    mockbtc_funcs=$(cat target/dev/private_btc_core_MockBTC.contract_class.json | grep -o '"type":"function"' | wc -l)
    echo "MockBTC functions: $mockbtc_funcs"
    
    # Check Vault ABI
    vault_funcs=$(cat target/dev/private_btc_core_PrivateBTCVault.contract_class.json | grep -o '"type":"function"' | wc -l)
    echo "Vault functions: $vault_funcs"
    
    if [ "$mockbtc_funcs" -gt 0 ] && [ "$vault_funcs" -gt 0 ]; then
        echo ""
        echo "✓ ABIs are valid! Contracts ready for deployment."
    else
        echo ""
        echo "✗ Warning: ABIs appear to be empty"
        exit 1
    fi
else
    echo ""
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "Build complete! Next steps:"
echo "1. Run deployment script: node backend/deploy_contracts_sepolia.js"
echo "2. Update backend/.env with new contract addresses"
echo "3. Test: node backend/test_deposit_fixed.js"
echo "=========================================="
