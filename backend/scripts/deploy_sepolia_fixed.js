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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var starknet_1 = require("starknet");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var dotenv = __importStar(require("dotenv"));
dotenv.config();
// ══════════════════════════════════════════════════════════════════════════════
// Starknet Sepolia V3-Compatible Deployment Script
// ══════════════════════════════════════════════════════════════════════════════
var RPC_URL = process.env.STARKNET_RPC_URL || process.env.SEPOLIA_RPC_URL || '';
var ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS || '0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1';
var PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';
if (!PRIVATE_KEY) {
    console.error('❌ SEPOLIA_PRIVATE_KEY is not set in .env');
    process.exit(1);
}
if (!RPC_URL) {
    console.error('❌ STARKNET_RPC_URL is not set in .env');
    process.exit(1);
}
console.log('🚀 PrivateBTC Vault — Starknet Sepolia Deployment');
console.log('═══════════════════════════════════════════════════\n');
console.log("   RPC URL: ".concat(RPC_URL.substring(0, 50), "..."));
console.log("   Account: ".concat(ACCOUNT_ADDRESS, "\n"));
var provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
var account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, '1');
// ──────────────────────────────────────────────────────────────────────────────
// Helper: Load contract artifacts
// ──────────────────────────────────────────────────────────────────────────────
function loadContract(name) {
    var base = path.join(__dirname, '../../contracts/target/dev');
    var sierraPath = path.join(base, "private_btc_core_".concat(name, ".contract_class.json"));
    var casmPath = path.join(base, "private_btc_core_".concat(name, ".compiled_contract_class.json"));
    if (!fs.existsSync(sierraPath)) {
        throw new Error("\u274C Sierra file not found: ".concat(sierraPath, "\n   Run: cd contracts && scarb build"));
    }
    if (!fs.existsSync(casmPath)) {
        throw new Error("\u274C Casm file not found: ".concat(casmPath, "\n   Run: cd contracts && scarb build"));
    }
    console.log("   \uD83D\uDCC4 Loading ".concat(name, "..."));
    var sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    var casm = JSON.parse(fs.readFileSync(casmPath, 'utf-8'));
    return { sierra: sierra, casm: casm };
}
// ──────────────────────────────────────────────────────────────────────────────
// Helper: Declare contract if not already declared
// ──────────────────────────────────────────────────────────────────────────────
function declareIfNotExists(name, sierra, casm) {
    return __awaiter(this, void 0, void 0, function () {
        var classHash, _a, declarePayload, _b, transaction_hash, class_hash, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 7, , 8]);
                    classHash = starknet_1.hash.computeContractClassHash(sierra);
                    console.log("\n\uD83D\uDD0D ".concat(name, " \u2014 Class Hash: ").concat(classHash));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, provider.getClassByHash(classHash)];
                case 2:
                    _c.sent();
                    console.log("   \u2705 Already declared on Sepolia\n");
                    return [2 /*return*/, classHash];
                case 3:
                    _a = _c.sent();
                    console.log("   \uD83D\uDCE4 Not declared yet. Declaring now...");
                    return [3 /*break*/, 4];
                case 4:
                    // Attempt declaration with V3 transaction (STRK fee)
                    console.log("   \u23F3 Declaring ".concat(name, " (V3 transaction)..."));
                    declarePayload = {
                        contract: sierra,
                        casm: casm,
                    };
                    return [4 /*yield*/, account.declare(declarePayload, { version: 3 })];
                case 5:
                    _b = _c.sent(), transaction_hash = _b.transaction_hash, class_hash = _b.class_hash;
                    console.log("   \uD83D\uDE80 Declaration TX: ".concat(transaction_hash));
                    console.log("   \u23F3 Waiting for confirmation...");
                    return [4 /*yield*/, provider.waitForTransaction(transaction_hash, {
                            retryInterval: 2000,
                            successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1']
                        })];
                case 6:
                    _c.sent();
                    console.log("   \u2705 ".concat(name, " declared successfully!"));
                    console.log("   \uD83D\uDD17 https://sepolia.voyager.online/tx/".concat(transaction_hash, "\n"));
                    return [2 /*return*/, class_hash];
                case 7:
                    error_1 = _c.sent();
                    console.error("   \u274C Failed to declare ".concat(name, ":"));
                    console.error("   ".concat(error_1.message || error_1));
                    if (error_1.response) {
                        console.error('   Response:', JSON.stringify(error_1.response, null, 2));
                    }
                    throw error_1;
                case 8: return [2 /*return*/];
            }
        });
    });
}
// ──────────────────────────────────────────────────────────────────────────────
// Helper: Deploy contract
// ──────────────────────────────────────────────────────────────────────────────
function deployContract(name, classHash, constructorArgs) {
    return __awaiter(this, void 0, void 0, function () {
        var deployPayload, _a, transaction_hash, contract_address, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    console.log("\n\uD83D\uDE80 Deploying ".concat(name, "..."));
                    console.log("   Class Hash: ".concat(classHash));
                    console.log("   Constructor Args: ".concat(JSON.stringify(constructorArgs)));
                    deployPayload = {
                        classHash: classHash,
                        constructorCalldata: starknet_1.CallData.compile(constructorArgs),
                    };
                    return [4 /*yield*/, account.deployContract(deployPayload, { version: 3 })];
                case 1:
                    _a = _b.sent(), transaction_hash = _a.transaction_hash, contract_address = _a.contract_address;
                    console.log("   \uD83D\uDE80 Deploy TX: ".concat(transaction_hash));
                    console.log("   \u23F3 Waiting for confirmation...");
                    return [4 /*yield*/, provider.waitForTransaction(transaction_hash, {
                            retryInterval: 2000,
                            successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1']
                        })];
                case 2:
                    _b.sent();
                    console.log("   \u2705 ".concat(name, " deployed at: ").concat(contract_address));
                    console.log("   \uD83D\uDD17 https://sepolia.voyager.online/contract/".concat(contract_address, "\n"));
                    return [2 /*return*/, contract_address];
                case 3:
                    error_2 = _b.sent();
                    console.error("   \u274C Failed to deploy ".concat(name, ":"));
                    console.error("   ".concat(error_2.message || error_2));
                    if (error_2.response) {
                        console.error('   Response:', JSON.stringify(error_2.response, null, 2));
                    }
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ──────────────────────────────────────────────────────────────────────────────
// Main deployment flow
// ──────────────────────────────────────────────────────────────────────────────
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var nonce, error_3, mockBtc, vault, mockBtcClassHash, vaultClassHash, mockBtcAddress, vaultAddress, deploymentInfo, outputPath, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    // Step 1: Check account balance
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('📊 Pre-flight Checks');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, account.getNonce()];
                case 2:
                    nonce = _a.sent();
                    console.log("   \u2705 Account accessible (nonce: ".concat(nonce, ")"));
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error('   ❌ Failed to access account. Check PRIVATE_KEY and ACCOUNT_ADDRESS');
                    throw error_3;
                case 4:
                    // Step 2: Load contract artifacts
                    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('📦 Loading Contract Artifacts');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                    mockBtc = loadContract('MockBTC');
                    vault = loadContract('PrivateBTCVault');
                    // Step 3: Declare MockBTC
                    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('📝 Declaring Contracts');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    return [4 /*yield*/, declareIfNotExists('MockBTC', mockBtc.sierra, mockBtc.casm)];
                case 5:
                    mockBtcClassHash = _a.sent();
                    return [4 /*yield*/, declareIfNotExists('PrivateBTCVault', vault.sierra, vault.casm)];
                case 6:
                    vaultClassHash = _a.sent();
                    // Step 5: Deploy MockBTC
                    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('🚢 Deploying Contracts');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    return [4 /*yield*/, deployContract('MockBTC', mockBtcClassHash, [ACCOUNT_ADDRESS])];
                case 7:
                    mockBtcAddress = _a.sent();
                    return [4 /*yield*/, deployContract('PrivateBTCVault', vaultClassHash, [mockBtcAddress])];
                case 8:
                    vaultAddress = _a.sent();
                    // Step 7: Save deployment info
                    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('💾 Saving Deployment Info');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                    deploymentInfo = {
                        network: 'starknet-sepolia',
                        deployedAt: new Date().toISOString(),
                        deployer: ACCOUNT_ADDRESS,
                        rpcUrl: RPC_URL,
                        contracts: {
                            MockBTC: {
                                classHash: mockBtcClassHash,
                                address: mockBtcAddress,
                            },
                            PrivateBTCVault: {
                                classHash: vaultClassHash,
                                address: vaultAddress,
                            },
                        },
                    };
                    outputPath = path.join(__dirname, '../deployment-info.json');
                    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
                    console.log("   \u2705 Saved to: ".concat(outputPath, "\n"));
                    // Step 8: Display summary
                    console.log('\n╔══════════════════════════════════════════════════╗');
                    console.log('║          🎉 DEPLOYMENT SUCCESSFUL 🎉             ║');
                    console.log('╚══════════════════════════════════════════════════╝\n');
                    console.log('📋 Contract Addresses:\n');
                    console.log("   MockBTC (sBTC):      ".concat(mockBtcAddress));
                    console.log("   PrivateBTCVault:     ".concat(vaultAddress, "\n"));
                    console.log('🔗 Voyager Links:\n');
                    console.log("   MockBTC:             https://sepolia.voyager.online/contract/".concat(mockBtcAddress));
                    console.log("   Vault:               https://sepolia.voyager.online/contract/".concat(vaultAddress, "\n"));
                    console.log('⚙️  Update your .env files:\n');
                    console.log('   Backend (.env):');
                    console.log("   VAULT_CONTRACT_ADDRESS=".concat(vaultAddress));
                    console.log("   MOCKBTC_CONTRACT_ADDRESS=".concat(mockBtcAddress));
                    console.log("   VAULT_ADDRESS=".concat(vaultAddress));
                    console.log("   SBTC_ADDRESS=".concat(mockBtcAddress, "\n"));
                    console.log('   Frontend (.env.local):');
                    console.log("   NEXT_PUBLIC_VAULT_ADDRESS=".concat(vaultAddress));
                    console.log("   NEXT_PUBLIC_MOCK_BTC_ADDRESS=".concat(mockBtcAddress, "\n"));
                    return [3 /*break*/, 10];
                case 9:
                    error_4 = _a.sent();
                    console.error('\n╔══════════════════════════════════════════════════╗');
                    console.error('║          ❌ DEPLOYMENT FAILED ❌                 ║');
                    console.error('╚══════════════════════════════════════════════════╝\n');
                    console.error('Error:', error_4.message || error_4);
                    if (error_4.stack) {
                        console.error('\nStack trace:');
                        console.error(error_4.stack);
                    }
                    process.exit(1);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
main();
