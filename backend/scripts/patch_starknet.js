const fs = require('fs');
const path = require('path');

const libs = [
  'node_modules/starknet/dist/index.js',
  'node_modules/starknet/dist/index.mjs'
];

libs.forEach(relPath => {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping missing lib: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // 1. Force isV3Tx to return true
  content = content.replace(/function isV3Tx\(details\) \{[^}]*\}/g, 'function isV3Tx(details) { return true; }');

  // 2. Force getVersionsByType to return V3 query versions
  const queryV3 = '0x100000000000000000000000000000003';
  content = content.replace(/function getVersionsByType\(versionType\) \{[^}]*\}/g, `function getVersionsByType(versionType) {
  return versionType === "fee" ? {
    v1: "${queryV3}",
    v2: "${queryV3}",
    v3: "${queryV3}"
  } : { v1: "0x3", v2: "0x3", v3: "0x3" };
}`);

  // 3. Fix all resource_bounds to include l1_data_gas
  const oldBounds = /resource_bounds: ([\w.]+)\.resourceBounds \|\| \{ l1_gas: \{ max_amount: "0x0", max_price_per_unit: "0x0" \}, l2_gas: \{ max_amount: "0x0", max_price_per_unit: "0x0" \} \}/g;
  const newBounds = 'resource_bounds: $1.resourceBounds || { l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" } }';
  content = content.replace(oldBounds, newBounds);

  // 3.0 Force V3 in all buildTransaction paths
  content = content.replace(/version: toHex\(invocation\.version \|\| defaultVersions\.(v1|v3)\)/g, 'version: toHex(defaultVersions.v3)');
  content = content.replace(/version: RPCSPEC07\.ETransactionVersion\.(V1|V2)/g, 'version: "0x3"');

  // 3.1 Fix estimateFeeToBounds and make it robust
  // First, restore original if we already patched it to apply fresh robust patch
  content = content.replace(/l1_data_gas: \{ max_amount: "0x0", max_price_per_unit: "0x0" \} \}/g, 'l1_gas: { max_amount: maxUnits, max_price_per_unit: maxUnitPrice } }');

  const robustEstimatePatch = `const maxUnits = (estimate.data_gas_consumed !== void 0 && estimate.data_gas_price !== void 0 && estimate.overall_fee !== void 0) ? toHex(addPercent(BigInt(estimate.overall_fee || 0) / BigInt(estimate.gas_price || 1), amountOverhead)) : toHex(addPercent(estimate.gas_consumed || 0, amountOverhead));
  const maxUnitPrice = toHex(addPercent(estimate.gas_price || 0, priceOverhead));
  return {
    l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: maxUnits, max_price_per_unit: maxUnitPrice },
    l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
  };`;

  content = content.replace(/const maxUnits = estimate\.data_gas_consumed[\s\S]*?l2_gas: \{ max_amount: "0x0", max_price_per_unit: "0x0" \}[\s\S]*?l1_gas: \{ max_amount: maxUnits, max_price_per_unit: maxUnitPrice \}\s+\};/g, robustEstimatePatch);

  // 4. Inject logging into fetch (ASYNCHRONOUS to capture response)
  content = content.replace(/fetch\(method, params, id = 0\) \{([\s\S]*?)return this\.baseFetch/g, (match, body) => {
    return `async fetch(method, params, id = 0) {
    const rpcRequestBody = {
      id,
      jsonrpc: "2.0",
      method,
      ...params && { params }
    };
    if (method !== "starknet_chainId") {
        console.log("!!! ATTENTION: RPC CALL !!!", method);
        console.log(JSON.stringify(rpcRequestBody, null, 2));
    }
    try {
        const response = await this.baseFetch`;
  });

  // Close the try block and log response (this matches the end of the fetch method better)
  content = content.replace(/await this\.baseFetch\(method, params, id\);[\s\S]*?\}/g, `await this.baseFetch(method, params, id);
        if (method !== "starknet_chainId") {
            console.log("!!! ATTENTION: RPC RESPONSE !!!", method);
            console.log(JSON.stringify(response, null, 2));
        }
        return response;
    } catch (e) {
        console.error("!!! ATTENTION: RPC ERROR !!!", method, e.message);
        throw e;
    }
  }`);

  fs.writeFileSync(fullPath, content);
  console.log(`✅ Patched ${relPath}`);
});
