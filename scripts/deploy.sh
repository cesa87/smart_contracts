#!/bin/bash

# Soroban Contract Deployment Script for Crynk Payment Splitter
# Make sure you have soroban CLI installed and configured

set -e

echo "🚀 Deploying Crynk Payment Splitter to Stellar Testnet"

# Configuration
NETWORK="testnet"
CONTRACT_DIR="payment-splitter"
WASM_PATH="target/wasm32-unknown-unknown/release/crynk_payment_splitter.wasm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if soroban CLI is installed
if ! command -v soroban &> /dev/null; then
    echo -e "${RED}❌ Soroban CLI not found. Please install it first:${NC}"
    echo "cargo install --locked soroban-cli"
    exit 1
fi

# Build the contract
echo -e "${YELLOW}📦 Building contract...${NC}"
cd $CONTRACT_DIR
cargo build --target wasm32-unknown-unknown --release

if [ ! -f "../$WASM_PATH" ]; then
    echo -e "${RED}❌ WASM file not found at $WASM_PATH${NC}"
    exit 1
fi

cd ..

# Deploy contract
echo -e "${YELLOW}🌐 Deploying to Stellar Testnet...${NC}"
CONTRACT_ADDRESS=$(soroban contract deploy \
    --wasm $WASM_PATH \
    --source-account default \
    --network $NETWORK)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Contract deployed successfully!${NC}"
    echo -e "${GREEN}📍 Contract Address: $CONTRACT_ADDRESS${NC}"
    
    # Save contract address to file
    echo $CONTRACT_ADDRESS > contract-address.txt
    echo -e "${GREEN}💾 Contract address saved to contract-address.txt${NC}"
    
    # Initialize contract (you'll need to customize these values)
    echo -e "${YELLOW}⚙️ Initializing contract...${NC}"
    echo "Please set the following environment variables or update this script:"
    echo "- ADMIN_ADDRESS: The admin address for the contract"
    echo "- FEE_WALLET: The wallet address to receive platform fees"
    echo "- TOKEN_ADDRESS: The USDC token address on Stellar"
    echo "- PLATFORM_FEE_RATE: The platform fee rate in basis points (100 = 1%)"
    
    # Example initialization (commented out - customize with your values)
    # soroban contract invoke \
    #     --id $CONTRACT_ADDRESS \
    #     --source-account default \
    #     --network $NETWORK \
    #     -- \
    #     initialize \
    #     --admin $ADMIN_ADDRESS \
    #     --fee_wallet $FEE_WALLET \
    #     --token_address $TOKEN_ADDRESS \
    #     --platform_fee_rate $PLATFORM_FEE_RATE
    
    echo -e "${GREEN}🎉 Deployment completed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Initialize the contract with your parameters"
    echo "2. Update your frontend environment variables:"
    echo "   REACT_APP_STELLAR_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
    echo "3. Test the contract functions"
    
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi 