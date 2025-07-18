# Initialize the Crynk Payment Splitter contract on Stellar MAINNET

# Configuration
$CONTRACT_ADDRESS = "CBQPFXE7TLM6KU3GXU43II7B5WK2OU4NOROS7NGXNBVQCSPGO5Z6KEBP"
$NETWORK = "mainnet"
$ADMIN_ADDRESS = "GAVOFBSHDCLDX4ALJRNDIAGLDVGEULX2PYVVSQA53JZQBAFR4QT44HBJ"
$FEE_WALLET = "GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
$USDC_MAINNET = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
$PLATFORM_FEE_RATE = "100"  # 1% = 100 basis points

Write-Host "Initializing Crynk Payment Splitter on Stellar MAINNET"
Write-Host "Contract Address: $CONTRACT_ADDRESS"
Write-Host "Admin Address: $ADMIN_ADDRESS"
Write-Host "Fee Wallet: $FEE_WALLET"
Write-Host "USDC Token: $USDC_MAINNET"
Write-Host "Platform Fee Rate: $PLATFORM_FEE_RATE basis points (1%)"
Write-Host ""

# Initialize contract
Write-Host "Initializing contract..."
soroban contract invoke --id $CONTRACT_ADDRESS --source-account alice --network $NETWORK -- initialize --admin $ADMIN_ADDRESS --fee_wallet $FEE_WALLET --token_address $USDC_MAINNET --platform_fee_rate $PLATFORM_FEE_RATE

if ($LASTEXITCODE -eq 0) {
    Write-Host "Contract initialized successfully!"
    
    # Verify initialization
    Write-Host "Verifying contract initialization..."
    
    Write-Host "Checking fee wallet..."
    soroban contract invoke --id $CONTRACT_ADDRESS --source-account alice --network $NETWORK -- get_fee_wallet
    
    Write-Host "Checking platform fee rate..."
    soroban contract invoke --id $CONTRACT_ADDRESS --source-account alice --network $NETWORK -- get_platform_fee_rate
    
    Write-Host "Contract is now ready for use!"
} else {
    Write-Host "Contract initialization failed"
} 