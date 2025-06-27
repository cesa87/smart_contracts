const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Starting Crynk Smart Contract Deployment...\n");

  // Get the contract factories
  const CrynkPaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
  const CrynkEscrowContract = await ethers.getContractFactory("CrynkEscrowContract");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deploying contracts with account:", deployer.address);
  
  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get deployment parameters
  const feeWallet = process.env.FEE_WALLET_ADDRESS || deployer.address;
  const usdcToken = "0xa0B86A33e6441abBBF0C8A6EBf8f3B0bA05C44c1"; // Sepolia USDC
  
  console.log("🔧 Deployment Parameters:");
  console.log("   Fee Wallet:", feeWallet);
  console.log("   USDC Token:", usdcToken);
  console.log("");

  // First deploy Escrow Contract (since Payment needs its address)
  console.log("📝 Deploying CrynkEscrowContract (placeholder)...");
  // Deploy with placeholder payment address first
  const tempEscrowContract = await CrynkEscrowContract.deploy(
    deployer.address, // Temporary payment contract address
    usdcToken         // USDC token address
  );
  await tempEscrowContract.waitForDeployment();
  const escrowAddress = await tempEscrowContract.getAddress();
  
  console.log("✅ CrynkEscrowContract deployed to:", escrowAddress);

  // Deploy Payment Contract with correct escrow address
  console.log("📝 Deploying CrynkPaymentContract...");
  const paymentContract = await CrynkPaymentContract.deploy(
    feeWallet,    // Fee wallet address
    escrowAddress // Escrow contract address
  );
  await paymentContract.waitForDeployment();
  const paymentAddress = await paymentContract.getAddress();
  
  console.log("✅ CrynkPaymentContract deployed to:", paymentAddress);

  // Update Escrow Contract with correct Payment address
  console.log("🔗 Linking contracts...");
  const updateTx = await tempEscrowContract.updatePaymentContract(paymentAddress);
  await updateTx.wait();
  console.log("✅ Contracts linked successfully!");

  // Display deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log(`📄 Network: ${hre.network.name}`);
  console.log(`💰 Gas Used: ${(await updateTx.wait()).gasUsed} gas`);
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log(`   Payment Contract: ${paymentAddress}`);
  console.log(`   Escrow Contract:  ${escrowAddress}`);
  console.log("");
  console.log("🔧 Next Steps:");
  console.log("1. Update your .env files with these contract addresses");
  console.log("2. Verify contracts on block explorer");
  console.log("3. Test the integration");
  console.log("");

  // Save deployment info to file
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      payment: {
        address: paymentAddress,
        constructor: [feeWallet, escrowAddress]
      },
      escrow: {
        address: escrowAddress,
        constructor: [deployer.address, usdcToken],
        updated: [paymentAddress]
      }
    },
    gasUsed: (await updateTx.wait()).gasUsed.toString()
  };

  const fs = require('fs');
  const deploymentFile = `deployment-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentFile}`);

  // Environment variables template
  console.log("\n📝 Add these to your .env files:");
  console.log("Backend (.env):");
  console.log(`PAYMENT_CONTRACT_ADDRESS=${paymentAddress}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log("");
  console.log("Frontend (.env):");
  console.log(`REACT_APP_PAYMENT_CONTRACT_ADDRESS=${paymentAddress}`);
  console.log(`REACT_APP_ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log("");

  // Verification commands
  if (hre.network.name !== "hardhat") {
    console.log("🔍 To verify contracts on Etherscan:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${paymentAddress} "${feeWallet}" "${escrowAddress}"`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${escrowAddress} "${deployer.address}" "${usdcToken}"`);
    console.log("");
  }
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 