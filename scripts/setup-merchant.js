const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🏪 Setting up merchant in Crynk Payment Contract...\n");

  // Contract address from deployment
  const paymentContractAddress = "0x24D60E82eDf732eaB2EF2d45f03B7025009e3c4B";
  const merchantId = 123; // Test merchant ID

  // Get the contract factory and attach to deployed contract
  const CrynkPaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
  const paymentContract = CrynkPaymentContract.attach(paymentContractAddress);

  // Get deployer account (should be the owner)
  const [deployer] = await ethers.getSigners();
  console.log("👤 Setting up merchant with account:", deployer.address);
  
  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  try {
    // Check if merchant is already valid
    const isValid = await paymentContract.validMerchants(merchantId);
    console.log(`📋 Merchant ${merchantId} current status:`, isValid);

    if (!isValid) {
      console.log(`🔧 Adding merchant ${merchantId} to valid merchants...`);
      
      // Add merchant to valid merchants list
      const tx = await paymentContract.updateMerchantStatus(merchantId, true);
      console.log("📤 Transaction sent:", tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed!");
      console.log("💰 Gas used:", receipt.gasUsed.toString());
      
      // Verify the merchant is now valid
      const isNowValid = await paymentContract.validMerchants(merchantId);
      console.log(`✅ Merchant ${merchantId} is now valid:`, isNowValid);
    } else {
      console.log(`✅ Merchant ${merchantId} is already valid!`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎉 MERCHANT SETUP COMPLETE!");
    console.log("=".repeat(50));
    console.log(`📋 Contract: ${paymentContractAddress}`);
    console.log(`🏪 Merchant ID: ${merchantId}`);
    console.log(`✅ Status: Valid`);
    console.log("");
    console.log("🔧 You can now use this merchant ID in your payment flow!");

  } catch (error) {
    console.error("❌ Error setting up merchant:", error.message);
    
    if (error.message.includes("Ownable: caller is not the owner")) {
      console.error("💡 Make sure you're using the same account that deployed the contract");
    }
  }
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }); 