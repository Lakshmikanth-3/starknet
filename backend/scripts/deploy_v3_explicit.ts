import { RpcProvider, Account, hash, CallData, cairo } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function main() {
    console.log('🚀 Explicit V3 Deployment (STRK)');

    // MockBTC Class hash
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = hash.computeContractClassHash(sierra);
    const constructorCalldata = CallData.compile({ owner: ACCOUNT_ADDRESS });

    try {
        console.log('⚖️  Estimating Fee...');
        const estimatedFee = await account.estimateDeployFee({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, { version: 3 });

        console.log('✅ Fee Estimated:', JSON.stringify(estimatedFee, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
            , 2));

        console.log('🚀 Deploying...');
        // Add 50% buffer to resource bounds
        const resourceBounds = {
            l1_gas: {
                max_amount: cairo.uint256(BigInt(estimatedFee.resourceBounds.l1_gas.max_amount) * 3n / 2n).low,
                max_price_per_unit: cairo.uint256(BigInt(estimatedFee.resourceBounds.l1_gas.max_price_per_unit) * 3n / 2n).low
            },
            l2_gas: {
                max_amount: cairo.uint256(BigInt(estimatedFee.resourceBounds.l2_gas.max_amount) * 3n / 2n).low,
                max_price_per_unit: cairo.uint256(BigInt(estimatedFee.resourceBounds.l2_gas.max_price_per_unit) * 3n / 2n).low
            }
        };

        // Simplify: just pass specific max_amount and max_price_per_unit as hex strings if cairo.uint256 fails
        // Actually estimateDeployFee returns struct with hex strings usually?

        // Let's just use what estimate returned directly but multiplied
        // estimatedFee.resourceBounds.l1_gas is { max_amount: '0x...', ... }

        const boostedBounds = {
            l1_gas: {
                max_amount: '0x' + (BigInt(estimatedFee.resourceBounds.l1_gas.max_amount) * 2n).toString(16),
                max_price_per_unit: '0x' + (BigInt(estimatedFee.resourceBounds.l1_gas.max_price_per_unit) * 2n).toString(16)
            },
            l2_gas: {
                max_amount: '0x' + (BigInt(estimatedFee.resourceBounds.l2_gas.max_amount) * 2n).toString(16),
                max_price_per_unit: '0x' + (BigInt(estimatedFee.resourceBounds.l2_gas.max_price_per_unit) * 2n).toString(16)
            }
        };

        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, {
            version: 3,
            resourceBounds: boostedBounds
        });

        console.log(`✅ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        console.log(`🎉 MockBTC Deployed at: ${deploy.contract_address}`);

    } catch (err: any) {
        console.error('❌ Failed:', err.message);
        if (err.data) console.error('Error Data:', err.data);
        fs.writeFileSync('v3_error.txt', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
}

main();
