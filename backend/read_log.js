const fs = require('fs');
const log = fs.readFileSync('wsl_debug.log', 'utf8');
// Find last PROVE block
const blocks = log.split('--- PROVE ---');
const lastBlock = blocks[blocks.length - 1];
console.log('=== LAST PROVE BLOCK ===');
console.log(lastBlock.slice(0, 2000));
