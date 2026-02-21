#!/bin/bash
echo "🔄 Building PrivateBTC Core..."

# Force load user profile (WSL fix)
source ~/.bashrc

# Ensure scarb is in path (manual fallback)
export PATH="$HOME/.local/bin:$PATH"

if ! command -v scarb &> /dev/null; then
    echo "❌ Error: 'scarb' not found."
    exit 1
fi

scarb build
echo "✅ Build complete!"
ls -lh target/dev/
