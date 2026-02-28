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

    // 1. Force V3 transactions in various checks
    content = content.replace(
        /function isV3Tx\(details\) \{[\s\S]*?return version === api_exports\.ETransactionVersion\.V3 \|\| version === api_exports\.ETransactionVersion\.F3;[\s\S]*?\}/g,
        'function isV3Tx(details) { return true; }'
    );
    // ESM version variants
    content = content.replace(
        /function isV3Tx\(details\) \{[\s\S]*?return version === RPCSPEC07\.ETransactionVersion\.V3 \|\| version === RPCSPEC07\.ETransactionVersion\.F3;[\s\S]*?\}/g,
        'function isV3Tx(details) { return true; }'
    );
    content = content.replace(
        /function isV3Tx\(details\) \{ return true; \}/g,
        'function isV3Tx(details) { return true; }'
    );

    // 2. Force V3 versions in getVersionsByType
    content = content.replace(
        /function getVersionsByType\(versionType\) \{[\s\S]*?return versionType === "fee" \? \{[\s\S]*?\} : \{ [\s\S]*? \};[\s\S]*?\}/g,
        `function getVersionsByType(versionType) {
  const queryV3 = '0x100000000000000000000000000000003';
  return versionType === "fee" ? {
    v1: queryV3,
    v2: queryV3,
    v3: queryV3
  } : { v1: "0x3", v2: "0x3", v3: "0x3" };
}`
    );

    // 3. Robust estimateFeeToBounds implementation
    // We'll replace the return block specifically to handle l1_data_gas properly
    content = content.replace(
        /return \{\s+l2_gas: \{ max_amount: "0x0", max_price_per_unit: "0x0" \},\s+l1_gas: \{ max_amount: (maxUnits|toHex\(addPercent\(gasConsumed, amountOverhead\)\)), max_price_per_unit: (maxUnitPrice|toHex\(addPercent\(gasPrice, priceOverhead\)\)) \}(?:,\s+l1_data_gas: \{ max_amount: "0x0", max_price_per_unit: "0x0" \})?\s+\};/g,
        `const dataGasConsumed = BigInt(estimate.data_gas_consumed || estimate.l1_data_gas_consumed || 0);
  const dataGasPrice = BigInt(estimate.data_gas_price || estimate.l1_data_gas_price || 0);
  const maxDataUnits = toHex(addPercent(dataGasConsumed, amountOverhead));
  const maxDataUnitPrice = toHex(addPercent(dataGasPrice, priceOverhead));
  return {
    l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: $1, max_price_per_unit: $2 },
    l1_data_gas: { max_amount: maxDataUnits, max_price_per_unit: maxDataUnitPrice }
  };`
    );

    // Also ensure the function signature and variables are correct
    content = content.replace(
        /function estimateFeeToBounds\(estimate, amountOverhead = 50, priceOverhead = 50\) \{[\s\S]*?const gasPrice = BigInt\(estimate\.gas_price \|\| 0\);/g,
        (match) => {
            if (match.includes('l1_gas_consumed')) return match; // already patched
            return `function estimateFeeToBounds(estimate, amountOverhead = 50, priceOverhead = 50) {
  if (typeof estimate === 'bigint' || (typeof estimate === 'object' && estimate === null)) {
    return {
      l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
    };
  }
  const gasConsumed = BigInt(estimate.gas_consumed || estimate.l1_gas_consumed || 0);
  const gasPrice = BigInt(estimate.gas_price || estimate.l1_gas_price || 0);`
        }
    );

    // 4. Robust fee parsing in ResponseParser
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
    content = content.replace(
        /suggestedMaxFee: this\.estimatedFeeToMaxFee\(val\.overall_fee\),/g,
        'suggestedMaxFee: this.estimatedFeeToMaxFee(val.overall_fee || 0), ...val,'
    );

    // 5. Force V3 in getPreferredVersion
    content = content.replace(
        /getPreferredVersion\(type12, type3\) \{[\s\S]*?if \(this\.transactionVersion === api_exports\.ETransactionVersion\.V3\) return type3;[\s\S]*?\}/g,
        'getPreferredVersion(type12, type3) { return api_exports.ETransactionVersion.V3; }'
    );
    content = content.replace(
        /getPreferredVersion\(type12, type3\) \{ return api_exports\.ETransactionVersion\.V3; \}/g,
        'getPreferredVersion(type12, type3) { return api_exports.ETransactionVersion.V3; }'
    );

    // 6. Fix resource_bounds in various locations
    content = content.replace(
        /resource_bounds: invocation\.resourceBounds,/g,
        'resource_bounds: invocation.resourceBounds || { l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" } },'
    );
    content = content.replace(
        /resource_bounds: details\.resourceBounds,/g,
        'resource_bounds: details.resourceBounds || { l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" } },'
    );

    // 7. Fix tip, paymaster_data, etc.
    content = content.replace(/tip: toHex\(details\.tip\),/g, 'tip: toHex(details.tip || 0),');
    content = content.replace(/tip: toHex\(invocation\.tip\),/g, 'tip: toHex(invocation.tip || 0),');
    content = content.replace(/paymaster_data: details\.paymasterData\.map\(/g, 'paymaster_data: (details.paymasterData || []).map(');
    content = content.replace(/paymaster_data: invocation\.paymasterData\.map\(/g, 'paymaster_data: (invocation.paymasterData || []).map(');
    content = content.replace(/account_deployment_data: details\.accountDeploymentData\.map\(/g, 'account_deployment_data: (details.accountDeploymentData || []).map(');
    content = content.replace(/account_deployment_data: invocation\.accountDeploymentData\.map\(/g, 'account_deployment_data: (invocation.accountDeploymentData || []).map(');
    content = content.replace(/nonce_data_availability_mode: details\.nonceDataAvailabilityMode,/g, 'nonce_data_availability_mode: details.nonceDataAvailabilityMode || 0,');
    content = content.replace(/nonce_data_availability_mode: invocation\.nonceDataAvailabilityMode,/g, 'nonce_data_availability_mode: invocation.nonceDataAvailabilityMode || 0,');
    content = content.replace(/fee_data_availability_mode: details\.feeDataAvailabilityMode/g, 'fee_data_availability_mode: details.feeDataAvailabilityMode || 0');
    content = content.replace(/fee_data_availability_mode: invocation\.feeDataAvailabilityMode,/g, 'fee_data_availability_mode: invocation.feeDataAvailabilityMode || 0,');

    fs.writeFileSync(fullPath, content);
    console.log(`Successfully patched ${relPath}`);
});
