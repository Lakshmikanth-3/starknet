import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const rpc = process.env.STARKNET_RPC_URL!;
    const headerAddr = process.env.HEADER_STORE_CONTRACT_ADDRESS!;

    async function isStored(height: number) {
        const hexHeight = "0x" + height.toString(16);
        // selector for is_header_stored
        const res = await fetch(rpc, {
            method: 'POST',
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "starknet_call",
                params: {
                    request: {
                        contract_address: headerAddr,
                        entry_point_selector: "0x1b203aabd91eab1a74d2badd9acced1939db26f1fa44efeeecea0a3fe6279f6", // sn_keccak of is_header_stored
                        calldata: [hexHeight]
                    },
                    block_id: "latest"
                },
                id: 1
            })
        });
        const d = await res.json();
        return d;
    }

    console.log("293884:", await isStored(293884));
    console.log("293885:", await isStored(293885));
}
main();
