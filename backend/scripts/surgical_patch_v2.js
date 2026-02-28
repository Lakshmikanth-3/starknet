const fs = require('fs');
const path = require('path');

const libs = [
    'node_modules/starknet/dist/index.js',
    'node_modules/starknet/dist/index.mjs'
];

libs.forEach(relPath => {
    const fullPath = path.resolve(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');

    // 0. Force blockIdentifier to latest
    content = content.replace(
        /blockIdentifier: BlockTag\.PENDING,/g,
        'blockIdentifier: BlockTag.LATEST,'
    );

    // 1. Force V2 transactions (pays in ETH)
    content = content.replace(
        /function isV3Tx\(details\) \{[\s\S]*?return version === api_exports\.ETransactionVersion\.V3 \|\| version === api_exports\.ETransactionVersion\.F3;[\s\S]*?\}/g,
        'function isV3Tx(details) { return false; }'
    );
    content = content.replace(
        /function isV3Tx\(details\) \{[\s\S]*?return version === RPCSPEC07\.ETransactionVersion\.V3 \|\| version === RPCSPEC07\.ETransactionVersion\.F3;[\s\S]*?\}/g,
        'function isV3Tx(details) { return false; }'
    );
    content = content.replace(
        /function isV3Tx\(details\) \{ return true; \}/g,
        'function isV3Tx(details) { return false; }'
    );

    // 2. Force V2 versions in getVersionsByType
    content = content.replace(
        /function getVersionsByType\(versionType\) \{[\s\S]*?return versionType === "fee" \? \{[\s\S]*?\} : \{ [\s\S]*? \};[\s\S]*?\}/g,
        `function getVersionsByType(versionType) {
  const queryV2 = '0x100000000000000000000000000000002';
  return versionType === "fee" ? {
    v1: queryV2,
    v2: queryV2,
    v3: queryV2
  } : { v1: "0x2", v2: "0x2", v3: "0x2" };
}`
    );

    // 3. Force V2 in getPreferredVersion
    content = content.replace(
        /getPreferredVersion\(type12, type3\) \{[\s\S]*?return api_exports\.ETransactionVersion\.V3;[\s\S]*?\}/g,
        'getPreferredVersion(type12, type3) { return api_exports.ETransactionVersion.V2; }'
    );
    content = content.replace(
        /getPreferredVersion\(type12, type3\) \{[\s\S]*?return api_exports\.ETransactionVersion\.V2;[\s\S]*?\}/g,
        'getPreferredVersion(type12, type3) { return api_exports.ETransactionVersion.V2; }'
    );

    // 4. Robust fee parsing
    content = content.replace(
        /overall_fee: toBigInt\(val\.overall_fee\),/g,
        'overall_fee: toBigInt(val.overall_fee || 0),'
    );
    content = content.replace(
        /gas_consumed: toBigInt\(val\.gas_consumed\),/g,
        'gas_consumed: toBigInt(val.gas_consumed || val.l1_gas_consumed || 0),'
    );
    content = content.replace(
        /gas_price: toBigInt\(val\.gas_price\),/g,
        'gas_price: toBigInt(val.gas_price || val.l1_gas_price || 0),'
    );

    fs.writeFileSync(fullPath, content);
    console.log(`Successfully patched ${relPath} to force V2`);
});
