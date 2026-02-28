const fs = require('fs');
const log = fs.readFileSync('wsl_debug.log', 'utf8');
const blocks = log.split('--- PROVE ---');
const lastBlock = blocks[blocks.length - 1];
// Write to utf8 file to avoid encoding issues
fs.writeFileSync('last_prove_block.txt', lastBlock, 'utf8');
console.log('Written to last_prove_block.txt, length:', lastBlock.length);
