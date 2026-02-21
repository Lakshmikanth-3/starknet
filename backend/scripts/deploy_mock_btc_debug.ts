
import { RpcProvider, Account, hash, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const DEBUG_LOG = 'debug_log.txt';
fs.writeFileSync(DEBUG_LOG, 'Script Started\n');

function debug(msg: string) {
    console.log(msg);
    fs.appendFileSync(DEBUG_LOG, msg + '\n');
}

const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

debug(`RPC: ${RPC_URL}`);
debug(`Account: ${ACCOUNT_ADDRESS}`);

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function main() {
    try {
        debug('Checking ETH balance...');
        const ethParams = {
            contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            entrypoint: 'balanceOf',
            calldata: [ACCOUNT_ADDRESS]
        };
        const ethBal = await provider.callContract(ethParams);
        debug(`ETH Balance Array: ${JSON.stringify(ethBal)}`);

        // MockBTC Class hash
        const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
        if (!fs.existsSync(sierraPath)) throw new Error('Sierra file not found');

        const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
        const classHash = hash.computeContractClassHash(sierra);
        debug(`Class Hash: ${classHash}`);

        debug('Attempting V2 deployContract...');
        const constructorCalldata = CallData.compile({ owner: ACCOUNT_ADDRESS });

        // Try V2
        try {
            const deploy = await account.deployContract({
                classHash: classHash,
                constructorCalldata: constructorCalldata
            }); // V2 is default
            debug(`V2 Success! Tx Hash: ${deploy.transaction_hash}`);
            await provider.waitForTransaction(deploy.transaction_hash);
            debug(`V2 Confirmed! Address: ${deploy.contract_address}`);
        } catch (v2Err: any) {
            debug(`V2 Failed: ${v2Err.message}`);
            debug(`V2 Error Details: ${JSON.stringify(v2Err, null, 2)}`);

            // Try V3
            debug('Attempting V3 deployContract...');
            try {
                const deploy = await account.deployContract({
                    classHash: classHash,
                    constructorCalldata: constructorCalldata
                }, { version: 3 });
                debug(`V3 Success! Tx Hash: ${deploy.transaction_hash}`);
                await provider.waitForTransaction(deploy.transaction_hash);
                debug(`V3 Confirmed! Address: ${deploy.contract_address}`);
            } catch (v3Err: any) {
                debug(`V3 Failed: ${v3Err.message}`);
                debug(`V3 Error Details: ${JSON.stringify(v3Err, null, 2)}`);
                throw v3Err;
            }
        }

    } catch (err: any) {
        debug(`Fatal Error: ${err.message}`);
        debug(`Fatal Stack: ${err.stack}`);
        process.exit(1);
    }
}

main();
