"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const body_parser_1 = __importDefault(require("body-parser"));
const app = (0, express_1.default)();
const PORT = 5051; // Our proxy port
const TARGET_URL = 'http://127.0.0.1:5050'; // Real devnet
app.use(body_parser_1.default.json());
app.post('*', async (req, res) => {
    // REWRITE THE BODY: Replace 'pending' with 'latest'
    let bodyStr = JSON.stringify(req.body);
    const originalBody = bodyStr;
    bodyStr = bodyStr.replace(/"pending"/g, '"latest"');
    if (bodyStr !== originalBody) {
        console.log(`🔄 Rewrote JSON-RPC call: ${req.body.method}`);
    }
    else {
        console.log(`➡️  Forwarding ${req.body.method}`);
    }
    try {
        const response = await (0, node_fetch_1.default)(TARGET_URL, {
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
    }
    catch (e) {
        console.error(`❌ Proxy Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 RPC Bridge active on http://127.0.0.1:${PORT} -> ${TARGET_URL}`);
});
