const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Deploy only the CrynkEscrowContract.
 *
 * Environment variables / CLI params expected:
 *   PAYMENT_CONTRACT_ADDRESS   existing CrynkPaymentContract on-chain
 *   USDC_TOKEN_ADDRESS         USDC token address for the network
 *   OWNER_ADDRESS              optional override for owner (defaults to deployer)
 */
async function main() {
  const paymentContractAddr = process.env.PAYMENT_CONTRACT_ADDRESS;
  const usdcTokenAddr = process.env.USDC_TOKEN_ADDRESS || "0xa0B86A33e6441abBBF0C8A6EBf8f3B0bA05C44c1"; // Sepolia default
  if (!paymentContractAddr) {
    throw new Error("PAYMENT_CONTRACT_ADDRESS env var not set");
  }

  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  console.log("🔗 Using existing payment contract:", paymentContractAddr);
  console.log("💵 USDC token:", usdcTokenAddr);

  const CrynkEscrowContract = await ethers.getContractFactory("CrynkEscrowContract");
  const escrow = await CrynkEscrowContract.deploy(paymentContractAddr, usdcTokenAddr);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("✅ Escrow deployed at:", escrowAddress);

  // Persist deployment info
  const fs = require("fs");
  const path = `deployment-escrow-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(path, JSON.stringify({
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    escrow: escrowAddress,
    paymentContract: paymentContractAddr,
    usdcToken: usdcTokenAddr,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(`💾 Saved deployment info to ${path}`);

  console.log("\nAdd to .env:\nREACT_APP_ESCROW_CONTRACT_ADDRESS=" + escrowAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 