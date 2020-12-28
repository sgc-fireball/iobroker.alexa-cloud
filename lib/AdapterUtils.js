'use strict';

class AdapterUtils {

    constructor(adapter) {
        this.adapter = adapter;
    }

    getUuid() {
        return new Promise((resolve) => {
            this.adapter.getForeignObject('system.meta.uuid', (err, obj) => {
                resolve(((obj || {}).native || {}).uuid || '00000000-0000-0000-0000-000000000000');
            });
        });
    }

    getSecret() {
        return new Promise((resolve) => {
            this.adapter.getForeignObject('system.meta.uuid', (err, obj) => {
                resolve(((obj || {}).native || {}).secret || 'Zgfr56gFe87jJOM');
            });
        });
    }

    encrypt(value) {
        return new Promise((resolve, reject) => {
            this.getSecret()
                .then((key) => {
                    let result = '';
                    for (let i = 0; i < value.length; ++i) {
                        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
                    }
                    resolve(result);
                })
                .catch(e => reject(e));
        });
    }

    decrypt(value) {
        return this.encrypt(value);
    }

    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

}

module.exports = AdapterUtils;
