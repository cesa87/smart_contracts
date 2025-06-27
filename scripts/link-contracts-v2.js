const { ethers } = require("hardhat");

async function main() {
    console.log("🔗 Linking Crynk Smart Contracts (High Gas Version)...");
    
    const [deployer] = await ethers.getSigners();
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    
    console.log(`📍 Deployer: ${deployer.address}`);
    console.log(`📍 Network: ${network.name} (${network.chainId})`);
    
    // Contract addresses from your deployment
    const escrowAddress = "0xd319A56c6d92D502D2F9fD53B948d0C3971862a0";
    const paymentAddress = "0xC601e41D02F9d974dAfa0B75398f5939CF9a3718";
    
    console.log(`📍 Escrow Contract: ${escrowAddress}`);
    console.log(`📍 Payment Contract: ${paymentAddress}`);
    
    // Use a fixed high gas price for testnet (5 gwei = 5,000,000,000 wei)
    const highGasPrice = "5000000000";
    
    console.log(`💰 Using gas price: 5 gwei (high priority)`);
    
    try {
        // Get contract instances using correct contract names
        const CrynkEscrowContract = await ethers.getContractFactory("CrynkEscrowContract");
        const CrynkPaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
        
        const escrowContract = CrynkEscrowContract.attach(escrowAddress);
        const paymentContract = CrynkPaymentContract.attach(paymentAddress);
        
        // Check current linking status first
        console.log("\n🔄 Checking current linking status...");
        
        try {
            const currentPaymentLink = await escrowContract.paymentContract();
            const currentEscrowLink = await paymentContract.escrowContract();
            
            console.log(`📍 Escrow currently linked to: ${currentPaymentLink}`);
            console.log(`📍 Payment currently linked to: ${currentEscrowLink}`);
            
            if (currentPaymentLink.toLowerCase() === paymentAddress.toLowerCase() && 
                currentEscrowLink.toLowerCase() === escrowAddress.toLowerCase()) {
                console.log("✅ Contracts are already properly linked!");
                return;
            }
        } catch (error) {
            console.log("⚠️  Could not check current linking status, proceeding with linking...");
        }
        
        // Link escrow to payment contract with high gas
        console.log("\n🔄 Linking escrow to payment contract...");
        const linkEscrowTx = await escrowContract.setPaymentContract(paymentAddress, {
            gasPrice: highGasPrice,
            gasLimit: 100000 // Set a reasonable gas limit
        });
        
        console.log(`⏳ Transaction sent: ${linkEscrowTx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        const linkEscrowReceipt = await linkEscrowTx.wait(2); // Wait for 2 confirmations
        console.log(`✅ Escrow linking confirmed in block ${linkEscrowReceipt.blockNumber}`);
        
        // Link payment to escrow contract with high gas
        console.log("\n🔄 Linking payment to escrow contract...");
        const linkPaymentTx = await paymentContract.setEscrowContract(escrowAddress, {
            gasPrice: highGasPrice,
            gasLimit: 100000
        });
        
        console.log(`⏳ Transaction sent: ${linkPaymentTx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        const linkPaymentReceipt = await linkPaymentTx.wait(2);
        console.log(`✅ Payment linking confirmed in block ${linkPaymentReceipt.blockNumber}`);
        
        // Verify linking
        console.log("\n🔄 Verifying contract linking...");
        
        const verifyPaymentLink = await escrowContract.paymentContract();
        const verifyEscrowLink = await paymentContract.escrowContract();
        
        console.log(`📍 Escrow now linked to: ${verifyPaymentLink}`);
        console.log(`📍 Payment now linked to: ${verifyEscrowLink}`);
        
        if (verifyPaymentLink.toLowerCase() === paymentAddress.toLowerCase() && 
            verifyEscrowLink.toLowerCase() === escrowAddress.toLowerCase()) {
            console.log("\n✅ SUCCESS! Contracts are properly linked!");
        } else {
            console.log("\n❌ ERROR! Linking verification failed!");
        }
        
    } catch (error) {
        console.error("❌ Error during linking:", error.message);
        
        if (error.message.includes("nonce")) {
            console.log("\n💡 Tip: There might be a pending transaction. Wait a moment and try again.");
        } else if (error.message.includes("gas")) {
            console.log("\n💡 Tip: Try increasing gas price or gas limit.");
        }
        
        throw error;
    }
}

main()
    .then(() => {
        console.log("\n🎉 Contract linking completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    }); 