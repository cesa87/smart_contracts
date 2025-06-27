const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Testing deployed contract functionality...");
  
  // Contract addresses from latest deployment
  const paymentContractAddress = "0x02e8910B3B89690d4aeC9fcC0Ae2cD16fB6A4828";
  const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  
  // Get deployer signer
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log("📋 Test Info:");
  console.log("- Payment Contract:", paymentContractAddress);
  console.log("- USDC Contract:", usdcAddress);
  console.log("- Deployer:", deployerAddress);
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("- Chain ID:", network.chainId.toString());
  
  try {
    // Load the payment contract
    const PaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
    const paymentContract = PaymentContract.attach(paymentContractAddress);
    
    console.log("\n🔍 Testing Contract Functions:");
    
    // Test 1: Check if merchant is valid
    console.log("1. Testing merchant validation...");
    const isValidMerchant = await paymentContract.validMerchants(123);
    console.log(`   Merchant 123 is valid: ${isValidMerchant}`);
    
    // Test 2: Check contract owner
    console.log("2. Testing contract owner...");
    const owner = await paymentContract.owner();
    console.log(`   Contract owner: ${owner}`);
    console.log(`   Is deployer owner: ${owner.toLowerCase() === deployerAddress.toLowerCase()}`);
    
    // Test 3: Check fee settings
    console.log("3. Testing fee settings...");
    const feeRate = await paymentContract.PLATFORM_FEE_RATE();
    const basisPoints = await paymentContract.BASIS_POINTS();
    console.log(`   Platform fee rate: ${feeRate} basis points (${Number(feeRate) / 100}%)`);
    console.log(`   Basis points: ${basisPoints}`);
    
    // Test 4: Check USDC address
    console.log("4. Testing USDC address...");
    const contractUsdcAddress = await paymentContract.USDC_ADDRESS();
    console.log(`   Contract USDC address: ${contractUsdcAddress}`);
    console.log(`   Expected USDC address: ${usdcAddress}`);
    console.log(`   USDC addresses match: ${contractUsdcAddress.toLowerCase() === usdcAddress.toLowerCase()}`);
    
    // Test 5: Check allowances
    console.log("5. Testing delegated allowances...");
    const allowance = await paymentContract.delegatedAllowances(deployerAddress, paymentContractAddress);
    console.log(`   Deployer allowance to contract: ${ethers.formatUnits(allowance, 6)} USDC`);
    
    // Test 6: Check USDC balance and allowance
    console.log("6. Testing USDC balance and ERC20 allowance...");
    const usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address,address) view returns (uint256)",
        "function symbol() view returns (string)"
      ],
      ethers.provider
    );
    
    const balance = await usdcContract.balanceOf(deployerAddress);
    const erc20Allowance = await usdcContract.allowance(deployerAddress, paymentContractAddress);
    const symbol = await usdcContract.symbol();
    
    console.log(`   Deployer ${symbol} balance: ${ethers.formatUnits(balance, 6)} ${symbol}`);
    console.log(`   ERC20 allowance to payment contract: ${ethers.formatUnits(erc20Allowance, 6)} ${symbol}`);
    
    // Test 7: Try a small test payment initiation
    console.log("7. Testing payment initiation...");
    
    if (Number(ethers.formatUnits(erc20Allowance, 6)) >= 10.1) {
      console.log("   Sufficient ERC20 allowance detected, testing payment initiation...");
      
      try {
        const testTx = await paymentContract.initiatePayment(
          123, // merchantId
          ethers.parseUnits("10", 18), // totalOrderAmount (18 decimals for USD)
          [usdcAddress], // tokenAddresses
          [ethers.parseUnits("10", 6)], // tokenAmounts (6 decimals for USDC)
          {
            gasLimit: 500000
          }
        );
        
        console.log("   📤 Payment initiation transaction sent:", testTx.hash);
        const receipt = await testTx.wait();
        console.log("   ✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("   📝 Transaction logs:", receipt.logs.length);
        
        // Check for events
        receipt.logs.forEach((log, index) => {
          console.log(`   Log ${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data
          });
        });
        
      } catch (error) {
        console.log("   ❌ Payment initiation failed:", error.message);
        
        if (error.message.includes("Insufficient delegated allowance")) {
          console.log("   💡 This is expected - the contract requires delegated allowance to be set first");
        }
      }
    } else {
      console.log("   ⚠️ Insufficient ERC20 allowance for testing payment initiation");
      console.log("   💡 Frontend should set ERC20 allowance first via approve() function");
    }
    
    console.log("\n✅ Contract test completed successfully!");
    
  } catch (error) {
    console.error("❌ Contract test failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 