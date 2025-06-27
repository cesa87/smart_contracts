# Smart Contract Deployment Guide

This guide will help you deploy the Crynk Payment Gateway smart contracts to get their addresses.

## Prerequisites

1. **Wallet with ETH** for gas fees (testnet ETH for Sepolia)
2. **Alchemy API Key** for RPC connection
3. **Private Key** of your deployment wallet
4. **Etherscan API Key** for verification (optional)

## Quick Setup

### 1. Get Testnet ETH
- Go to [Sepolia Faucet](https://sepoliafaucet.com/)
- Enter your wallet address
- Get free testnet ETH

### 2. Get Alchemy API Key
- Sign up at [Alchemy](https://www.alchemy.com/)
- Create a new app on Sepolia network
- Copy your API key

### 3. Export Private Key
- Open MetaMask
- Click on account menu → Account Details → Export Private Key
- **⚠️ NEVER share this key or commit it to version control**

## Deployment Steps

### 1. Install Dependencies
```bash
cd smart-contracts
npm install
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your credentials:
# PRIVATE_KEY=your_wallet_private_key
# ALCHEMY_API_KEY=your_alchemy_api_key  
# FEE_WALLET_ADDRESS=address_to_receive_fees
# DISPUTE_RESOLUTION_ADMIN=admin_address_for_disputes
```

### 3. Compile Contracts
```bash
npm run compile
```

### 4. Deploy to Sepolia (Testnet)
```bash
npm run deploy:sepolia
```

### 5. Verify Contracts (Optional)
```bash
# The deployment script will show verification commands
# Example:
npx hardhat verify --network sepolia CONTRACT_ADDRESS "CONSTRUCTOR_ARG"
```

## Deployment Output

After successful deployment, you'll get:

```
🎉 DEPLOYMENT COMPLETE!
============================================================
📄 Network: sepolia
📋 Contract Addresses:
   Payment Contract: 0x1234567890123456789012345678901234567890
   Escrow Contract:  0x0987654321098765432109876543210987654321

📝 Add these to your .env files:
Backend (.env):
PAYMENT_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
ESCROW_CONTRACT_ADDRESS=0x0987654321098765432109876543210987654321

Frontend (.env):
REACT_APP_PAYMENT_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
REACT_APP_ESCROW_CONTRACT_ADDRESS=0x0987654321098765432109876543210987654321
```

## Update Your Application

1. **Backend**: Add contract addresses to `crynk-backend/.env`
2. **Frontend**: Add contract addresses to `crynk-frontend/.env`

## Troubleshooting

### Common Issues

**"Insufficient funds for gas"**
- Get more testnet ETH from faucet
- Check your wallet balance

**"Missing private key"**
- Make sure PRIVATE_KEY is set in .env
- Private key should NOT have '0x' prefix

**"Network connection failed"**
- Check your ALCHEMY_API_KEY
- Verify RPC URL in hardhat.config.js

**"Contract compilation failed"**
- Make sure OpenZeppelin contracts are installed
- Check Solidity version (should be 0.8.20)

### Getting Help

- Check Hardhat documentation: https://hardhat.org/docs
- Etherscan for contract verification: https://sepolia.etherscan.io/
- OpenZeppelin contracts: https://docs.openzeppelin.com/

## Production Deployment

For mainnet deployment:

1. **Get real ETH** for gas fees
2. **Update environment** for mainnet
3. **Deploy carefully**:
   ```bash
   npm run deploy:mainnet
   ```
4. **Verify contracts** on Etherscan
5. **Test thoroughly** before going live

## Security Notes

- ✅ Contracts include security features (reentrancy protection, access control)
- ✅ Admin functions are protected
- ✅ Fees are handled securely
- ⚠️ Test thoroughly on testnet first
- ⚠️ Keep private keys secure
- ⚠️ Use multi-sig for production admin functions 