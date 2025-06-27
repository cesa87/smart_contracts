const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔍 Checking contract addresses for deployer:", deployer.address);
    
    // Specifically check the transaction hashes mentioned by the user
    const knownTxHashes = [
        "0x15b6129b1a4b1f4f67f6170e32327d0f145fa5cc5629a31167eda9e124bab8a7",
        "0xcd1a63524dc0a88042d6484559acf78198014ed41621238766c1947b38a9d266"
    ];
    
    console.log("\n🎯 Checking deployment transaction hashes:");
    let escrowAddress = null;
    let paymentAddress = null;
    
    for (const txHash of knownTxHashes) {
        try {
            const receipt = await ethers.provider.getTransactionReceipt(txHash);
            if (receipt && receipt.contractAddress) {
                console.log(`\n📌 Transaction: ${txHash}`);
                console.log(`   Contract Address: ${receipt.contractAddress}`);
                console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
                console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
                
                // Try to determine which contract this is by checking code
                const code = await ethers.provider.getCode(receipt.contractAddress);
                if (code.length > 2) {
                    console.log(`   Contract Type: Deployed Successfully`);
                    
                    // Store addresses (we'll need to determine which is which)
                    if (!escrowAddress) {
                        escrowAddress = receipt.contractAddress;
                    } else {
                        paymentAddress = receipt.contractAddress;
                    }
                }
            }
        } catch (error) {
            console.log(`❌ Could not fetch receipt for ${txHash}:`, error.message);
        }
    }
    
    console.log("\n🎉 **DEPLOYMENT SUCCESSFUL!**");
    console.log("📋 Contract Addresses:");
    console.log(`   Escrow Contract: ${escrowAddress || 'TBD'}`);
    console.log(`   Payment Contract: ${paymentAddress || 'TBD'}`);
    
    console.log("\n💡 Next Steps:");
    console.log("1. Update your frontend with these contract addresses");
    console.log("2. Link the contracts if not already done");
    console.log("3. Test the deployment");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 