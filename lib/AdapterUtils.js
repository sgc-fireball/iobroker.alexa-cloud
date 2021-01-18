'use strict';

const https = require('https');
const querystring = require('querystring');

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

    debounce(func, wait, immediate) {
        let timeout;
        return () => {
            let context = this, args = arguments;
            let later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            let callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    normalizeDeviceId(id) {
        id = 'iobroker:' + id;
        id = id.replace(/\./g, ':');
        id = id.replace(/[^a-zA-Z0-9_\-=#;:?@&]/g, '_');
        return id;
    }

    request(path, params = {}) {
        const body = querystring.stringify(params);
        return new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                protocol: 'https:',
                hostname: 'api.amazon.com',
                port: 443,
                path: path,
                headers: {
                    'Connection': 'Close',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': body.length
                }
            };
            const request = https.request(options, (response) => {
                let chunks = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    chunks += chunk;
                });
                response.on('end', () => {
                    response.statusCode === 200 ? resolve(chunks) : reject(chunks);
                });
            });
            request.on('error', reject);
            request.write(body);
            request.end();
        });
    }

}

module.exports = AdapterUtils;
