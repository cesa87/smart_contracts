# Mainnet Deployment Instructions

## Summary

✅ **Testnet Deployment Complete**
- Contract Address: `CCRLJU7MZGPKQ6TBIZQK32UXBZMSWBT65SIFQKBXGPUEFHQLMVJNBJRW`
- Fee Wallet: `GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE` (your address)
- Platform Fee Rate: 100 basis points (1%)
- Testnet USDC: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`

## For Mainnet Deployment

To deploy the payment splitter contract to Stellar mainnet:

### 1. Fund Your Account

You need a funded Stellar account to deploy to mainnet. You can either:

**Option A: Import your existing key**
```bash
stellar keys add my-mainnet-key --secret-key <YOUR_SECRET_KEY>
```

**Option B: Generate a new key and fund it**
```bash
stellar keys generate my-mainnet-key
stellar keys address my-mainnet-key
# Send XLM to the address above to fund it
```

### 2. Deploy to Mainnet

Once you have a funded account, run:

```bash
cd soroban-contracts
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crynk_payment_splitter.wasm \
  --source-account my-mainnet-key \
  --network mainnet
```

### 3. Initialize the Contract

Replace `<CONTRACT_ADDRESS>` with the address from step 2:

```bash
stellar contract invoke \
  --id <CONTRACT_ADDRESS> \
  --source-account my-mainnet-key \
  --network mainnet \
  -- \
  initialize \
  --admin GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE \
  --fee_wallet GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE \
  --token_address GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
  --platform_fee_rate 100
```

### 4. Update Frontend Configuration

Add to your `.env` file:
```bash
REACT_APP_STELLAR_CONTRACT_ADDRESS=<CONTRACT_ADDRESS>
REACT_APP_STELLAR_USE_MAINNET=true
REACT_APP_STELLAR_FEE_WALLET=GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE
```

### 5. Verify Deployment

Check the contract state:
```bash
stellar contract invoke \
  --id <CONTRACT_ADDRESS> \
  --source-account my-mainnet-key \
  --network mainnet \
  -- \
  get_fee_wallet

stellar contract invoke \
  --id <CONTRACT_ADDRESS> \
  --source-account my-mainnet-key \
  --network mainnet \
  -- \
  get_platform_fee_rate
```

## Contract Functions

The deployed contract supports:

- `split_payment`: Percentage-based fee splitting
- `split_payment_fixed`: Fixed amount fee splitting  
- `get_fee_wallet`: Returns the fee wallet address
- `get_platform_fee_rate`: Returns the platform fee rate
- `get_payment`: Get payment details by ID
- `get_payment_count`: Get total payment count

## Addresses Used

- **Admin/Fee Wallet**: `GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE`
- **Mainnet USDC**: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
- **Testnet USDC**: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`

Both merchant and platform fees will be sent to the same address as requested. 