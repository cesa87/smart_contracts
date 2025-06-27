const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Contract Linking Status...");
    
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log(`📍 Network: ${network.name} (${network.chainId})`);
    
    // Transaction hash from the stuck linking attempt
    const txHash = "0x7a63c496357103aa881813583e968ab749ac8278e256be93e9d39326b42be97f";
    
    // Contract addresses
    const escrowAddress = "0xd319A56c6d92D502D2F9fD53B948d0C3971862a0";
    const paymentAddress = "0xC601e41D02F9d974dAfa0B75398f5939CF9a3718";
    
    console.log(`📍 Escrow Contract: ${escrowAddress}`);
    console.log(`📍 Payment Contract: ${paymentAddress}`);
    console.log(`📍 Transaction Hash: ${txHash}`);
    
    try {
        // Check transaction status
        console.log("\n🔄 Checking transaction status...");
        const tx = await provider.getTransaction(txHash);
        
        if (!tx) {
            console.log("❌ Transaction not found on network");
            console.log("This might mean the transaction was never submitted or is on a different network");
            return;
        }
        
        console.log(`✅ Transaction found!`);
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        
        // Format gas price more safely
        try {
            const gasPriceGwei = ethers.utils.formatUnits(tx.gasPrice, "gwei");
            console.log(`   Gas Price: ${gasPriceGwei} gwei`);
        } catch (e) {
            console.log(`   Gas Price: ${tx.gasPrice?.toString() || "unknown"}`);
        }
        
        console.log(`   Gas Limit: ${tx.gasLimit?.toString() || "unknown"}`);
        
        // Check if transaction was mined
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
            console.log("⏳ Transaction is still pending...");
            return;
        }
        
        console.log(`✅ Transaction mined in block ${receipt.blockNumber}`);
        console.log(`   Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
        console.log(`   Gas Used: ${receipt.gasUsed?.toString() || "unknown"}`);
        
        if (receipt.status === 0) {
            console.log("❌ Transaction failed!");
            return;
        }
        
        // Check contract linking status
        console.log("\n🔄 Verifying contract linking...");
        
        // Get contract instances
        const CrynkEscrow = await ethers.getContractFactory("CrynkEscrow");
        const escrowContract = CrynkEscrow.attach(escrowAddress);
        
        try {
            // Try to get the payment contract address from escrow
            const linkedPaymentContract = await escrowContract.paymentContract();
            console.log(`📍 Escrow's linked payment contract: ${linkedPaymentContract}`);
            
            if (linkedPaymentContract.toLowerCase() === paymentAddress.toLowerCase()) {
                console.log("✅ Contracts are properly linked!");
            } else if (linkedPaymentContract === "0x0000000000000000000000000000000000000000") {
                console.log("❌ Escrow contract is not linked to any payment contract");
            } else {
                console.log("⚠️  Escrow is linked to a different payment contract");
            }
        } catch (error) {
            console.log("❌ Error checking escrow contract:", error.message);
        }
        
        // Check if payment contract can interact with escrow
        try {
            const CrynkPayment = await ethers.getContractFactory("CrynkPayment");
            const paymentContract = CrynkPayment.attach(paymentAddress);
            
            const linkedEscrowContract = await paymentContract.escrowContract();
            console.log(`📍 Payment's linked escrow contract: ${linkedEscrowContract}`);
            
            if (linkedEscrowContract.toLowerCase() === escrowAddress.toLowerCase()) {
                console.log("✅ Payment contract is properly linked to escrow!");
            } else if (linkedEscrowContract === "0x0000000000000000000000000000000000000000") {
                console.log("❌ Payment contract is not linked to any escrow contract");
            } else {
                console.log("⚠️  Payment is linked to a different escrow contract");
            }
        } catch (error) {
            console.log("❌ Error checking payment contract:", error.message);
        }
        
        // Summary
        console.log("\n📋 Summary:");
        if (receipt.status === 1) {
            console.log("✅ Linking transaction completed successfully");
            console.log("✅ You can now proceed with testing your contracts");
        } else {
            console.log("❌ Linking transaction failed");
            console.log("📝 You may need to run the linking script again");
        }
        
    } catch (error) {
        console.error("❌ Error checking linking status:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    }); 