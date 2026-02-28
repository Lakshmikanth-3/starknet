import { SharpService } from '../src/services/SharpService';
import { CryptoService } from '../src/services/CryptoService';

async function main() {
    console.log("🔐 Generating ZK Proof for SBTC Minting on Starknet...");

    // If user passed secret/salt args, use them; otherwise randomly generate
    const secret = process.argv[2] || CryptoService.generateRandomness();
    // salt usually is small enough integer if the frontend uses `parseInt`, but generateRandomness if generic
    const salt = process.argv[3] || Math.floor(Math.random() * 100000).toString();

    console.log(`👤 ZK Secret: ${secret}`);
    console.log(`🧂 Salt: ${salt}`);

    console.log("⏳ Submitting proof to SHARP...");
    try {
        const { jobKey } = await SharpService.submitProof(secret, salt);
        console.log(`✅ Proof submitted! Job Key: ${jobKey}`);

        console.log("🔍 Checking proof status...");
        const status = await SharpService.checkProofStatus(jobKey);
        console.log(`📄 Status: ${status.status}, On-Chain: ${status.onChain}`);

        console.log("\n✅ Done! You can now use your ZK secret to mint sBTC in Starknet.");
    } catch (error) {
        console.error("❌ Failed to generate ZK proof:", error);
    }
}

main();
