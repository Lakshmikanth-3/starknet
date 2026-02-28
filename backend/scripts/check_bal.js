require('dotenv').config();
const { RpcProvider, Contract, CallData } = require('starknet');

async function main() {
    const p = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const acc = process.env.STARKNET_ACCOUNT_ADDRESS;
    console.log('Account:', acc);

    const ETH = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562B82f9e004dc7';
    const STRK = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

    const getBalStr = async (addr) => {
        try {
            const res = await p.callContract({
                contractAddress: addr,
                entrypoint: 'balanceOf',
                calldata: CallData.compile({ account: acc })
            }, 'latest');
            return JSON.stringify(res);
        } catch (e) {
            try {
                const res2 = await p.callContract({
                    contractAddress: addr,
                    entrypoint: 'balance_of',
                    calldata: CallData.compile({ account: acc })
                }, 'latest');
                return JSON.stringify(res2);
            } catch (e2) {
                return 'err: ' + e2.message;
            }
        }
    };

    console.log('ETH:', await getBalStr(ETH));
    console.log('STRK:', await getBalStr(STRK));
}

main().catch(console.error);
