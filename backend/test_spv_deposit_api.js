async function run() {
    try {
        const txid = '2d92947d9ad9cc0169cf21dc16af82958554d2db309b9ce5227d1cb97d095b17';
        console.log(`📡 Fetching proof...`);
        const res = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
        const proof = await res.json();
        
        console.log(`Got proof. Making deposit request...`);
        const reqBody = {
            commitment: '0x1234567890abcdef',
            blockHeight: proof.blockHeight,
            txPos: proof.txPos,
            rawTxBytes: proof.rawTxBytes,
            voutIndex: proof.voutIndex,
            merkleProofWords: proof.merkleProofWords,
            bitcoin_txid: txid,
            vault_id: 'e69aebde-39e2-45e0-9422-959c5a528cc6',
            amount: 0.0001
        };
        
        const depRes = await fetch(`http://localhost:3001/api/bridge/spv-deposit`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(reqBody)
        });
        
        const depData = await depRes.json();
        console.log(depRes.status, depData);
    } catch(e) {
        console.error(e);
    }
}
run();
