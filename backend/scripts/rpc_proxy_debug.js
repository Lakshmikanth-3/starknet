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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const body_parser_1 = __importDefault(require("body-parser"));
const fs = __importStar(require("fs"));
const app = (0, express_1.default)();
const PORT = 5051;
const TARGET_URL = 'http://127.0.0.1:5050';
app.use(body_parser_1.default.json());
const logStream = fs.createWriteStream('bridge_detailed.log', { flags: 'a' });
app.post('*', async (req, res) => {
    let requestBody = req.body;
    const requestUrl = `${TARGET_URL}${req.url}`;
    const method = requestBody.method;
    logStream.write(`\n--- New Request ---\n`);
    logStream.write(`Method: ${method}\n`);
    if (method === 'starknet_addDeclareTransaction') {
        logStream.write(`📦 DECLARE TRANSACTION DETECTED\n`);
    }
    // 1. Aggressive stripping of modern fields
    let bodyStr = JSON.stringify(requestBody);
    // Remove simulation_flags
    if (bodyStr.includes('"simulation_flags"')) {
        logStream.write(`🛡️ STRIPPING simulation_flags\n`);
        if (requestBody.params) {
            delete requestBody.params.simulation_flags;
        }
    }
    // Remove resource_bounds (V3 field)
    if (bodyStr.includes('"resource_bounds"')) {
        logStream.write(`🛡️ STRIPPING resource_bounds\n`);
        if (requestBody.params && requestBody.params.transaction) {
            delete requestBody.params.transaction.resource_bounds;
            delete requestBody.params.transaction.tip;
            delete requestBody.params.transaction.paymaster_data;
            delete requestBody.params.transaction.account_deployment_data;
            delete requestBody.params.transaction.fee_data_availability_mode;
            delete requestBody.params.transaction.nonce_data_availability_mode;
        }
    }
    // 2. Rewrite pending -> latest for blockId in requests
    if (bodyStr.includes('"block_id":"pending"') || bodyStr.includes('"block_id": "pending"')) {
        if (requestBody.params && requestBody.params.block_id === 'pending') {
            requestBody.params.block_id = 'latest';
            logStream.write(`🔄 REWROTE REQ: pending -> latest (block_id)\n`);
        }
    }
    let dataStr = JSON.stringify(requestBody);
    // 3. Downgrade high-bit query transaction versions
    if (dataStr.includes('0x1000000000000000000000000000000')) {
        logStream.write(`🎯 MATCHED high-bit version string\n`);
        dataStr = dataStr.replace(/0x1000000000000000000000000000000/g, '0x');
        logStream.write(`🔄 REWROTE REQ: query_version -> legacy_version\n`);
    }
    // 4. Spoof specVersion to 0.4.0 if requested
    if (method === 'starknet_specVersion') {
        logStream.write(`🎯 MATCHED starknet_specVersion request\n`);
        const spoofedResponse = {
            jsonrpc: "2.0",
            result: "0.4.0",
            id: requestBody.id
        };
        logStream.write(`✅ SPOOFED RES: specVersion -> 0.4.0\n`);
        return res.json(spoofedResponse);
    }
    try {
        const response = await (0, node_fetch_1.default)(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: dataStr,
        });
        const data = await response.json();
        let respStr = JSON.stringify(data);
        logStream.write(`RES: ${respStr.substring(0, 500)}...\n`);
        // Rewrite pending -> latest for blockId in responses (safer regex)
        if (respStr.includes('"block_id":"pending"')) {
            respStr = respStr.replace(/"block_id"\s*:\s*"pending"/g, '"block_id":"latest"');
            logStream.write(`⏪ REWROTE RES: pending -> latest (block_id)\n`);
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(respStr);
    }
    catch (e) {
        logStream.write(`❌ ERROR: ${e.message}\n`);
        res.status(500).json({ error: e.message });
    }
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced RPC Bridge active on port ${PORT}`);
});
