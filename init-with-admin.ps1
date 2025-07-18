# Initialize contract with admin secret key
# Set the secret key as environment variable (temporary)
$env:ADMIN_SECRET = "SABFSYS7LANDNQB2WWUKHFJBHZDYIOHAJJUKXBSGWUWYLHMML6EXB77V"

# Contract configuration
$CONTRACT_ADDRESS = "CBQPFXE7TLM6KU3GXU43II7B5WK2OU4NOROS7NGXNBVQCSPGO5Z6KEBP"
$NETWORK = "mainnet"
$ADMIN_ADDRESS = "GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
$FEE_WALLET = "GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
$USDC_MAINNET = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
$PLATFORM_FEE_RATE = "100"

Write-Host "Initializing contract with admin key..."

# Try using secret key directly with invoke command
soroban contract invoke `
    --id $CONTRACT_ADDRESS `
    --source $env:ADMIN_SECRET `
    --network $NETWORK `
    -- `
    initialize `
    --admin $ADMIN_ADDRESS `
    --fee_wallet $FEE_WALLET `
    --token_address $USDC_MAINNET `
    --platform_fee_rate $PLATFORM_FEE_RATE

if ($LASTEXITCODE -eq 0) {
    Write-Host "Contract initialized successfully!"
    
    # Test the initialization
    Write-Host "Testing fee wallet..."
    soroban contract invoke --id $CONTRACT_ADDRESS --source $env:ADMIN_SECRET --network $NETWORK -- get_fee_wallet
    
    Write-Host "Testing platform fee rate..."
    soroban contract invoke --id $CONTRACT_ADDRESS --source $env:ADMIN_SECRET --network $NETWORK -- get_platform_fee_rate
} else {
    Write-Host "Contract initialization failed"
}

# Clear the environment variable for security
Remove-Item env:ADMIN_SECRET 