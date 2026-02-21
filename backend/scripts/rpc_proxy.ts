import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';

const app = express();
const PORT = 5051; // Our proxy port
const TARGET_URL = 'http://127.0.0.1:5050'; // Real devnet

app.use(bodyParser.json());

app.post('*', async (req, res) => {
    // REWRITE THE BODY: Replace 'pending' with 'latest'
    let bodyStr = JSON.stringify(req.body);
    const originalBody = bodyStr;
    bodyStr = bodyStr.replace(/"pending"/g, '"latest"');

    if (bodyStr !== originalBody) {
        console.log(`🔄 Rewrote JSON-RPC call: ${req.body.method}`);
    } else {
        console.log(`➡️  Forwarding ${req.body.method}`);
    }

    try {
        const response = await fetch(TARGET_URL, {
            method: 'POST',
            body: bodyStr,
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        let dataStr = JSON.stringify(data);
        const originalDataStr = dataStr;
        dataStr = dataStr.replace(/"pending"/g, '"latest"');

        if (dataStr !== originalDataStr) {
            console.log(`⏪ Rewrote JSON-RPC response for: ${req.body.method}`);
        }

        res.json(JSON.parse(dataStr));
    } catch (e: any) {
        console.error(`❌ Proxy Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 RPC Bridge active on http://127.0.0.1:${PORT} -> ${TARGET_URL}`);
});
