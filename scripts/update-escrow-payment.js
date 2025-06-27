const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const escrowAddr = process.env.ESCROW_CONTRACT_ADDRESS;
  const paymentAddr = process.env.PAYMENT_CONTRACT_ADDRESS;
  if (!escrowAddr || !paymentAddr) {
    throw new Error("ESCROW_CONTRACT_ADDRESS and PAYMENT_CONTRACT_ADDRESS env vars required");
  }
  const [signer] = await ethers.getSigners();
  console.log("Escrow:", escrowAddr);
  console.log("New payment address:", paymentAddr);

  const CrynkEscrowContract = await ethers.getContractFactory("CrynkEscrowContract");
  const escrow = CrynkEscrowContract.attach(escrowAddr).connect(signer);
  const tx = await escrow.updatePaymentContract(paymentAddr);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("✅ Escrow linked to payment contract!");
}

main().catch((e)=>{console.error(e);process.exit(1);}); 