process.on('uncaughtException', function (e) {
    require('fs').writeFileSync('/tmp/node_err.txt', e.stack || e.message || String(e));
    process.exit(1);
});
require('./deploy_spv.js');
