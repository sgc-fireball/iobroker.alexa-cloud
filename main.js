'use strict';

const Adapter = require('./lib/Adapter');
let adapter;
if (module.parent) {
    adapter = module.exports = (options) => new Adapter(options);
} else {
    adapter = new Adapter();
}

if (!!process) {
    process.on('SIGINT', () => {
        adapter && adapter.log.warn('Received SIGINT');
    });

    process.on('SIGTERM', () => {
        adapter && adapter.log.warn('Received SIGTERM');
    });

    process.on('uncaughtException', (err) => {
        if (adapter && adapter.log) {
            adapter.log.warn('Exception: ' + err);
        }
    });
}
