#!/bin/bash

# Fix Contract Address Script
# Updates .env file with correct contract address

echo "🔧 Fixing Contract Address in .env..."

# Backup .env
cp .env .env.backup.$(date +%s)
echo "✅ Backup created"

# Update CONTRACT_ADDRESS
sed -i '' 's/CONTRACT_ADDRESS=0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC/CONTRACT_ADDRESS=0x9171Cf8E1d3c7EBf7bf8866CcD2c8C58512A3Be8/' .env

# Add JAAS_SUB if missing
if ! grep -q "JAAS_SUB" .env; then
    echo "" >> .env
    echo "# JaaS Subject (for JWT)" >> .env
    echo "JAAS_SUB=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd" >> .env
    echo "✅ Added JAAS_SUB"
fi

# Add RPC_URL if missing  
if ! grep -q "^RPC_URL=" .env; then
    echo "" >> .env
    echo "# Primary RPC URL" >> .env
    echo "RPC_URL=https://avax-fuji.g.alchemy.com/v2/Yo4enHB113igpnycl13On" >> .env
    echo "✅ Added RPC_URL"
fi

echo ""
echo "✅ Contract address updated successfully!"
echo ""
echo "Updated values:"
grep "CONTRACT_ADDRESS" .env
grep "JAAS_SUB" .env 2>/dev/null
grep "^RPC_URL" .env 2>/dev/null
echo ""
echo "🚀 Please restart the server: npm run dev"
