"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const starknet_1 = require("starknet");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const DEBUG_LOG = 'debug_log.txt';
fs.writeFileSync(DEBUG_LOG, 'Script Started\n');
function debug(msg) {
    console.log(msg);
    fs.appendFileSync(DEBUG_LOG, msg + '\n');
}
const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';
debug(`RPC: ${RPC_URL}`);
debug(`Account: ${ACCOUNT_ADDRESS}`);
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
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
        if (!fs.existsSync(sierraPath))
            throw new Error('Sierra file not found');
        const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
        const classHash = starknet_1.hash.computeContractClassHash(sierra);
        debug(`Class Hash: ${classHash}`);
        debug('Attempting V2 deployContract...');
        const constructorCalldata = starknet_1.CallData.compile({ owner: ACCOUNT_ADDRESS });
        // Try V2
        try {
            const deploy = await account.deployContract({
                classHash: classHash,
                constructorCalldata: constructorCalldata
            }); // V2 is default
            debug(`V2 Success! Tx Hash: ${deploy.transaction_hash}`);
            await provider.waitForTransaction(deploy.transaction_hash);
            debug(`V2 Confirmed! Address: ${deploy.contract_address}`);
        }
        catch (v2Err) {
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
            }
            catch (v3Err) {
                debug(`V3 Failed: ${v3Err.message}`);
                debug(`V3 Error Details: ${JSON.stringify(v3Err, null, 2)}`);
                throw v3Err;
            }
        }
    }
    catch (err) {
        debug(`Fatal Error: ${err.message}`);
        debug(`Fatal Stack: ${err.stack}`);
        process.exit(1);
    }
}
main();
