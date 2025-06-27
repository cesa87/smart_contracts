const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying CrynkPaymentSplitter V2 (with ETH support) to Sepolia...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("❌ Insufficient ETH balance for deployment. Need at least 0.01 ETH");
  }

  // Configuration for Sepolia
  const feeWallet = deployer.address; // Use deployer as fee wallet for now
  const sepoliaUSDC = "0xa0B86A33e6441abBBF0C8A6EBf8f3B0bA05C44c1"; // Sepolia USDC address
  
  console.log("⚙️ Deployment Configuration:");
  console.log("- Fee Wallet:", feeWallet);
  console.log("- USDC Address:", sepoliaUSDC);
  console.log("- Platform Fee Rate: 1% (100 basis points)");

  // Deploy the contract
  console.log("\n📦 Compiling and deploying contract...");
  
  const CrynkPaymentSplitter = await ethers.getContractFactory("CrynkPaymentSplitter");
  const splitter = await CrynkPaymentSplitter.deploy(feeWallet, sepoliaUSDC);
  
  await splitter.waitForDeployment();
  const splitterAddress = await splitter.getAddress();

  console.log("\n✅ Deployment successful!");
  console.log("📍 Contract Address:", splitterAddress);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  
  try {
    const deployedFeeWallet = await splitter.feeWallet();
    const deployedUSDCAddress = await splitter.usdcAddress();
    const deployedFeeRate = await splitter.platformFeeRate();
    
    console.log("✅ Verification successful:");
    console.log("- Fee Wallet:", deployedFeeWallet);
    console.log("- USDC Address:", deployedUSDCAddress);
    console.log("- Platform Fee Rate:", deployedFeeRate.toString(), "(1% = 100)");
    
    // Test fee calculation
    const testAmount = ethers.parseEther("1"); // 1 ETH
    const [platformFee, merchantAmount] = await splitter.calculateFees(testAmount);
    
    console.log("\n🧮 Fee Calculation Test (1 ETH):");
    console.log("- Platform Fee:", ethers.formatEther(platformFee), "ETH");
    console.log("- Merchant Amount:", ethers.formatEther(merchantAmount), "ETH");
    
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }

  // Save deployment info
  console.log("\n💾 Saving deployment information...");
  
  const deploymentInfo = {
    network: "sepolia",
    contractName: "CrynkPaymentSplitter",
    version: "v2",
    address: splitterAddress,
    deployer: deployer.address,
    feeWallet: feeWallet,
    usdcAddress: sepoliaUSDC,
    platformFeeRate: 100,
    timestamp: new Date().toISOString(),
    transactionHash: splitter.deploymentTransaction()?.hash,
    features: [
      "USDC payments",
      "ETH payments", 
      "Automatic splitting",
      "1% platform fee",
      "Configurable fee wallet"
    ]
  };

  const fs = require('fs');
  const filename = `deployment-splitter-v2-sepolia-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("📄 Deployment info saved to:", filename);

  // Environment variable updates
  console.log("\n🔧 Environment Variable Updates:");
  console.log("Add this to your .env files:");
  console.log(`   REACT_APP_PAYMENT_SPLITTER_ADDRESS=${splitterAddress}`);
  console.log(`   REACT_APP_SEPOLIA_PAYMENT_SPLITTER=${splitterAddress}`);

  // Contract verification on Etherscan
  console.log("\n🔗 Etherscan Verification:");
  console.log(`View on Sepolia Etherscan: https://sepolia.etherscan.io/address/${splitterAddress}`);

  console.log("\n🎉 Deployment Complete!");
  console.log("Your updated Payment Splitter is ready for ETH and USDC payments!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 