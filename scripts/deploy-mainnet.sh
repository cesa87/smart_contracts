#!/bin/bash

# Soroban Contract Deployment Script for Crynk Payment Splitter - MAINNET
# Make sure you have soroban CLI installed and configured for mainnet

set -e

echo "🚀 Deploying Crynk Payment Splitter to Stellar MAINNET"

# Configuration
NETWORK="mainnet"
CONTRACT_DIR="payment-splitter"
WASM_PATH="target/wasm32-unknown-unknown/release/crynk_payment_splitter.wasm"

# Contract parameters
ADMIN_ADDRESS="GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
FEE_WALLET="GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
USDC_MAINNET="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"  # Official USDC on Stellar mainnet
PLATFORM_FEE_RATE="100"  # 1% = 100 basis points

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Configuration:${NC}"
echo -e "Network: ${YELLOW}$NETWORK${NC}"
echo -e "Admin Address: ${YELLOW}$ADMIN_ADDRESS${NC}"
echo -e "Fee Wallet: ${YELLOW}$FEE_WALLET${NC}"
echo -e "USDC Token: ${YELLOW}$USDC_MAINNET${NC}"
echo -e "Platform Fee Rate: ${YELLOW}$PLATFORM_FEE_RATE basis points (1%)${NC}"
echo ""

# Check if stellar CLI is installed
if ! command -v stellar &> /dev/null; then
    echo -e "${RED}❌ Stellar CLI not found. Please install it first:${NC}"
    echo "cargo install --locked stellar-cli"
    exit 1
fi

# Check if mainnet network is configured
if ! stellar network ls | grep -q "$NETWORK"; then
    echo -e "${YELLOW}⚙️  Adding mainnet network configuration...${NC}"
    stellar network add mainnet \
        --rpc-url https://soroban-mainnet.stellar.org:443 \
        --network-passphrase "Public Global Stellar Network ; September 2015"
fi

# Check if we have a funded account
echo -e "${YELLOW}🔍 Checking account configuration...${NC}"
if ! stellar config identity ls | grep -q default; then
    echo -e "${RED}❌ No default identity found. Please configure with:${NC}"
    echo "stellar config identity generate default"
    echo "stellar config identity fund default --network mainnet"
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
echo -e "${YELLOW}🌐 Deploying to Stellar Mainnet...${NC}"
echo -e "${RED}⚠️  THIS WILL USE REAL XLM ON MAINNET! ⚠️${NC}"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

CONTRACT_ADDRESS=$(stellar contract deploy \
    --wasm $WASM_PATH \
    --source-account default \
    --network $NETWORK)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Contract deployed successfully!${NC}"
    echo -e "${GREEN}📍 Contract Address: $CONTRACT_ADDRESS${NC}"
    
    # Save contract address to file
    echo $CONTRACT_ADDRESS > contract-address-mainnet.txt
    echo -e "${GREEN}💾 Contract address saved to contract-address-mainnet.txt${NC}"
    
    # Initialize contract
    echo -e "${YELLOW}⚙️ Initializing contract...${NC}"
    stellar contract invoke \
        --id $CONTRACT_ADDRESS \
        --source-account default \
        --network $NETWORK \
        -- \
        initialize \
        --admin $ADMIN_ADDRESS \
        --fee_wallet $FEE_WALLET \
        --token_address $USDC_MAINNET \
        --platform_fee_rate $PLATFORM_FEE_RATE

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Contract initialized successfully!${NC}"
        
        # Verify initialization by checking contract state
        echo -e "${YELLOW}🔍 Verifying contract initialization...${NC}"
        FEE_WALLET_CHECK=$(stellar contract invoke \
            --id $CONTRACT_ADDRESS \
            --source-account default \
            --network $NETWORK \
            -- \
            get_fee_wallet)
        
        PLATFORM_FEE_CHECK=$(stellar contract invoke \
            --id $CONTRACT_ADDRESS \
            --source-account default \
            --network $NETWORK \
            -- \
            get_platform_fee_rate)
        
        echo -e "${GREEN}✅ Verification complete:${NC}"
        echo -e "Fee Wallet: ${YELLOW}$FEE_WALLET_CHECK${NC}"
        echo -e "Platform Fee Rate: ${YELLOW}$PLATFORM_FEE_CHECK basis points${NC}"
        
        echo -e "${GREEN}🎉 MAINNET Deployment completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "1. Add to your .env file:"
        echo "   REACT_APP_STELLAR_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
        echo "   REACT_APP_STELLAR_USE_MAINNET=true"
        echo "   REACT_APP_STELLAR_FEE_WALLET=$FEE_WALLET"
        echo ""
        echo "2. Test the contract with small amounts first"
        echo "3. Monitor transactions at: https://stellar.expert/explorer/public/contract/$CONTRACT_ADDRESS"
        
    else
        echo -e "${RED}❌ Contract initialization failed${NC}"
        exit 1
    fi
    
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi 