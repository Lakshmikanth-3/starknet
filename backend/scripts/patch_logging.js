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

    // More robust matching for the fetch function, catching both 'fetch' and 'async fetch'
    // and correctly handling the body of the function.
    const fetchRegex = /(?:async\s+)?fetch\(method, params, id = 0\) \{[\s\S]*?const rpcRequestBody = \{[\s\S]*?\};([\s\S]*?)try \{([\s\S]*?)const response = await this\.baseFetch\([\s\S]*?\);([\s\S]*?)return response;([\s\S]*?)\} catch \(e\) \{[\s\S]*?\}[\s\S]*?\}/g;

    // Actually, let's just do a simpler replace of the whole block if possible, 
    // or better, a very targeted one.

    // Let's try to find the baseFetch call and wrap it
    const baseFetchRegex = /const response = await this\.baseFetch\(([\s\S]*?)\);/g;

    // First, let's make sure we have the rpcRequestBody logging
    if (!content.includes('console.log("!!! RPC CALL:", method)')) {
        content = content.replace(
            /(?:async\s+)?fetch\(method, params, id = 0\) \{([\s\S]*?)const rpcRequestBody = \{([\s\S]*?)\};/g,
            (match, p1, p2) => {
                return `async fetch(method, params, id = 0) {
    const rpcRequestBody = {${p2}};
    if (method !== "starknet_chainId") {
        console.log("!!! RPC CALL:", method);
        console.log(JSON.stringify(rpcRequestBody, null, 2));
    }
`;
            }
        );
    }

    // Now add body logging if not present
    if (!content.includes('console.log("!!! RPC RESPONSE BODY:", responseBody)')) {
        content = content.replace(
            /const response = await this\.baseFetch\(([\s\S]*?)\);/g,
            `const response = await this.baseFetch($1);
        const responseClone = response.clone();
        const responseBody = await responseClone.text();
        if (method !== "starknet_chainId") {
            console.log("!!! RPC RESPONSE STATUS:", response.status);
            console.log("!!! RPC RESPONSE BODY:", responseBody);
        }`
        );
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Successfully applied full logging patch to ${relPath}`);
});
