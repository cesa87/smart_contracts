const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying contracts to forked mainnet environment...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log("📋 Deployment Info:");
  console.log("- Deployer address:", deployerAddress);
  console.log("- Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployerAddress)), "ETH");
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("- Network:", network.name);
  console.log("- Chain ID:", network.chainId.toString());
  
  // Verify we're on forked mainnet (accept both chain ID 1 and 31337 when forking)
  const isForkedMainnet = network.chainId === 1n || network.chainId === 31337n;
  
  if (!isForkedMainnet) {
    throw new Error(`Expected chain ID 1 (mainnet) or 31337 (hardhat fork), got ${network.chainId}. Make sure you're running on forked mainnet.`);
  }
  
  // Check if we're actually forked by trying to get mainnet USDC balance
  const MAINNET_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const USDC_WHALE = "0x28C6c06298d514Db089934071355E5743bf21d60";
  
  try {
    // Try to get USDC contract - this will only work if we're forked from mainnet
    const usdcContract = new ethers.Contract(
      MAINNET_USDC,
      ["function symbol() view returns (string)", "function balanceOf(address) view returns (uint256)"],
      ethers.provider
    );
    
    const symbol = await usdcContract.symbol();
    const whaleBalance = await usdcContract.balanceOf(USDC_WHALE);
    
    console.log(`✅ Forked mainnet detected - USDC whale has ${ethers.formatUnits(whaleBalance, 6)} ${symbol}`);
  } catch (error) {
    console.warn("⚠️ Warning: Could not verify mainnet fork. This might be a regular hardhat network.");
    console.warn("Make sure you started hardhat with: npx hardhat node --fork <MAINNET_RPC_URL>");
  }
  
  // Contract deployment parameters
  const feeWallet = deployerAddress; // Use deployer as fee wallet for testing
  
  // Gas settings for forked mainnet
  const gasSettings = {
    gasLimit: 5000000, // 5M gas limit
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  };
  
  console.log("⛽ Using gas settings:", {
    gasLimit: gasSettings.gasLimit,
    gasPrice: ethers.formatUnits(gasSettings.gasPrice, "gwei") + " gwei"
  });
  
  // Pre-calculate the next two contract addresses
  const deployerNonce = await ethers.provider.getTransactionCount(deployerAddress);
  console.log("📡 Current deployer nonce:", deployerNonce);
  
  // Calculate what the contract addresses will be
  const predictedPaymentAddress = ethers.getCreateAddress({
    from: deployerAddress,
    nonce: deployerNonce
  });
  
  const predictedEscrowAddress = ethers.getCreateAddress({
    from: deployerAddress,
    nonce: deployerNonce + 1
  });
  
  console.log("🔮 Predicted addresses:");
  console.log("- Payment contract:", predictedPaymentAddress);
  console.log("- Escrow contract:", predictedEscrowAddress);
  
  // Deploy CrynkPaymentContract first (using predicted escrow address)
  console.log("\n📦 Deploying CrynkPaymentContract...");
  const CrynkPaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
  
  const paymentContract = await CrynkPaymentContract.deploy(
    feeWallet, 
    predictedEscrowAddress, // Use predicted escrow address
    gasSettings
  );
  await paymentContract.waitForDeployment();
  const paymentAddress = await paymentContract.getAddress();
  console.log("✅ CrynkPaymentContract deployed to:", paymentAddress);
  
  // Verify the address matches prediction
  if (paymentAddress.toLowerCase() !== predictedPaymentAddress.toLowerCase()) {
    console.warn("⚠️ Warning: Payment contract address doesn't match prediction!");
    console.warn("Expected:", predictedPaymentAddress);
    console.warn("Actual:", paymentAddress);
  }

  // Deploy CrynkEscrowContract with payment contract address and USDC token
  console.log("\n📦 Deploying CrynkEscrowContract...");
  const CrynkEscrowContract = await ethers.getContractFactory("CrynkEscrowContract");
  const escrowContract = await CrynkEscrowContract.deploy(
    paymentAddress, 
    MAINNET_USDC,
    gasSettings
  );
  await escrowContract.waitForDeployment();
  const escrowAddress = await escrowContract.getAddress();
  console.log("✅ CrynkEscrowContract deployed to:", escrowAddress);
  
  // Verify the address matches prediction
  if (escrowAddress.toLowerCase() !== predictedEscrowAddress.toLowerCase()) {
    console.warn("⚠️ Warning: Escrow contract address doesn't match prediction!");
    console.warn("Expected:", predictedEscrowAddress);
    console.warn("Actual:", escrowAddress);
    
    // If addresses don't match, we need to update the payment contract
    console.log("🔄 Updating payment contract with actual escrow address...");
    await paymentContract.setEscrowContract(escrowAddress, gasSettings);
    console.log("✅ Payment contract updated with correct escrow address");
  }

  // Setup test merchant
  console.log("\n👤 Setting up test merchant...");
  const testMerchantId = 123;
  const testMerchantAddress = deployerAddress; // Use deployer as test merchant
  
  try {
    await paymentContract.updateMerchantStatus(testMerchantId, true, gasSettings);
    console.log(`✅ Test merchant registered: ID ${testMerchantId}, Address: ${testMerchantAddress}`);
  } catch (error) {
    console.log("⚠️ Merchant registration failed (may already exist):", error.message);
  }

  // Verify merchant registration
  const isValidMerchant = await paymentContract.validMerchants(testMerchantId);
  console.log(`✅ Merchant ${testMerchantId} validation:`, isValidMerchant);

  // Save deployment addresses
  const deploymentInfo = {
    network: network.chainId === 1n ? "mainnet_fork" : "hardhat_fork",
    chainId: network.chainId.toString(),
    paymentContract: paymentAddress,
    escrowContract: escrowAddress,
    feeWallet: feeWallet,
    deployer: deployerAddress,
    testMerchant: {
      id: testMerchantId,
      address: testMerchantAddress
    },
    tokens: {
      USDC: MAINNET_USDC, // Mainnet USDC
    },
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  // Write deployment info to file
  const fs = require('fs');
  const deploymentFile = `deployment-fork-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 Deployment completed successfully!");
  console.log("📄 Deployment info saved to:", deploymentFile);
  console.log("\n📋 Contract Addresses:");
  console.log("- Payment Contract:", paymentAddress);
  console.log("- Escrow Contract:", escrowAddress);
  console.log("- Fee Wallet:", feeWallet);
  console.log("- USDC Token (Mainnet):", MAINNET_USDC);
  
  console.log("\n🔧 Environment Variables for Frontend:");
  console.log(`REACT_APP_PAYMENT_CONTRACT_ADDRESS=${paymentAddress}`);
  console.log(`REACT_APP_ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log(`REACT_APP_NETWORK=${deploymentInfo.network}`);

  console.log("\n📡 Next Steps:");
  if (network.chainId === 31337n) {
    console.log("1. Add MetaMask network: http://127.0.0.1:8545 (Chain ID: 31337)");
    console.log("2. For Squid API compatibility, use chain ID 1 in frontend");
  } else {
    console.log("1. Add MetaMask network: http://127.0.0.1:8545 (Chain ID: 1)");
  }
  console.log("3. Import test accounts using hardhat default mnemonic");
  console.log("4. Update frontend environment variables");
  console.log("5. Test payments with real mainnet USDC addresses and Squid API");

  return deploymentInfo;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 