/**
 * Minimal surgical patch for starknet.js 6.24.1 compatibility with Starknet v0.14
 * Fixes:
 *  1. Default blockIdentifier: PENDING -> LATEST (Alchemy rejects pending for estimation)
 *  2. Adds l1_data_gas to resource_bounds in fee estimation (required by Starknet v0.14)
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '..', 'node_modules/starknet/dist/index.js');

if (!fs.existsSync(indexPath)) {
  console.error('starknet index.js not found!');
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');
let changes = 0;

// ── Fix 1: Default blockIdentifier PENDING → LATEST ─────────────────────────
// There are 2 occurrences in defaultOptions (rpc_0_6 and rpc_0_7)
const pendingDefault = /var (defaultOptions\d*) = \{\s*headers: \{ "Content-Type": "application\/json" \},\s*blockIdentifier: BlockTag\.PENDING,/g;
const fixedDefault = content.replace(pendingDefault, (match, name) => {
  changes++;
  return match.replace('blockIdentifier: BlockTag.PENDING,', 'blockIdentifier: BlockTag.LATEST,');
});

if (fixedDefault === content) {
  console.warn('⚠  PENDING default already fixed or pattern not found');
} else {
  content = fixedDefault;
  console.log(`✅ Fix 1: Changed ${changes} PENDING → LATEST default(s)`);
}

// ── Fix 2: Add l1_data_gas to the estimateFee request body ───────────────────
// The fee estimation in the RPC channel sends a resource_bounds without l1_data_gas
// Starknet v0.14 requires it. We patch the buildTransaction helper that constructs the tx.
//
// Target the V3 details block in buildTransaction (rpc_0_7):
//   resource_bounds: invocation.resourceBounds,
// Replace with a version that merges in l1_data_gas
const rbPattern = `resource_bounds: invocation.resourceBounds,
        tip: toHex(invocation.tip),
        paymaster_data: invocation.paymasterData.map((it) => toHex(it)),
        nonce_data_availability_mode: invocation.nonceDataAvailabilityMode,
        fee_data_availability_mode: invocation.feeDataAvailabilityMode,
        account_deployment_data: invocation.accountDeploymentData.map((it) => toHex(it))`;

const rbReplacement = `resource_bounds: {
          ...(invocation.resourceBounds || {}),
          l1_data_gas: (invocation.resourceBounds && invocation.resourceBounds.l1_data_gas)
            ? invocation.resourceBounds.l1_data_gas
            : { max_amount: "0x0", max_price_per_unit: "0x0" }
        },
        tip: toHex(invocation.tip || 0),
        paymaster_data: (invocation.paymasterData || []).map((it) => toHex(it)),
        nonce_data_availability_mode: invocation.nonceDataAvailabilityMode,
        fee_data_availability_mode: invocation.feeDataAvailabilityMode,
        account_deployment_data: (invocation.accountDeploymentData || []).map((it) => toHex(it))`;

if (content.includes(rbPattern)) {
  content = content.replace(rbPattern, rbReplacement);
  changes++;
  console.log('✅ Fix 2: Added l1_data_gas to fee estimation resource_bounds');
} else {
  console.warn('⚠  l1_data_gas pattern not matched — checking alternative...');
  // Alternative: patch the rpc_0_6 V3 invoke block too
  const rb2Pattern = `resource_bounds: details.resourceBounds,\n          tip: toHex(details.tip),\n          paymaster_data: details.paymasterData.map((it) => toHex(it)),`;
  const rb2Replacement = `resource_bounds: {\n            ...(details.resourceBounds || {}),\n            l1_data_gas: (details.resourceBounds && details.resourceBounds.l1_data_gas)\n              ? details.resourceBounds.l1_data_gas\n              : { max_amount: "0x0", max_price_per_unit: "0x0" }\n          },\n          tip: toHex(details.tip || 0),\n          paymaster_data: (details.paymasterData || []).map((it) => toHex(it)),`;
  if (content.includes(rb2Pattern)) {
    content = content.replace(rb2Pattern, rb2Replacement);
    changes++;
    console.log('✅ Fix 2 (alt): Added l1_data_gas to rpc_0_6 resource_bounds');
  } else {
    console.warn('⚠  Could not patch l1_data_gas — manual fix may be required');
  }
}

// ── Fix 3: estimateFeeToBounds — include l1_data_gas in return ───────────────
const estFeePattern = `return {
    l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: maxUnits, max_price_per_unit: maxUnitPrice }
  };`;
const estFeeReplacement = `return {
    l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: maxUnits, max_price_per_unit: maxUnitPrice },
    l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
  };`;
if (content.includes(estFeePattern)) {
  content = content.replace(estFeePattern, estFeeReplacement);
  changes++;
  console.log('✅ Fix 3: Added l1_data_gas to estimateFeeToBounds return');
}

// Also fix the ZERO return in estimateFeeToBounds
const zeroPattern = `return {
    l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
  };`;
const zeroReplacement = `return {
    l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
  };`;
if (content.includes(zeroPattern)) {
  content = content.replace(zeroPattern, zeroReplacement);
  changes++;
  console.log('✅ Fix 3b: Added l1_data_gas to zero resource_bounds');
}

fs.writeFileSync(indexPath, content);
console.log(`\n✅ Patch complete: ${changes} changes applied to index.js`);

// Validate syntax
const { execSync } = require('child_process');
try {
  execSync(`node --check "${indexPath}"`, { stdio: 'pipe' });
  console.log('✅ Syntax check passed');
} catch (e) {
  console.error('❌ Syntax check FAILED:', e.stderr?.toString());
  process.exit(1);
}
