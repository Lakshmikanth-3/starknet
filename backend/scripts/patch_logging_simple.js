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

    // Just wrap baseFetch with simple status log
    content = content.replace(
        /const response = await this\.baseFetch\(([\s\S]*?)\);/g,
        `const response = await this.baseFetch($1);
        if (method !== "starknet_chainId") { console.log("!!! RPC RESPONSE STATUS:", response.status); }`
    );

    fs.writeFileSync(fullPath, content);
    console.log(`Successfully applied simple logging to ${relPath}`);
});
