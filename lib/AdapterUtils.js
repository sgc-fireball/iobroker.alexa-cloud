'use strict';

const https = require('https');
const http = require('http');
const querystring = require('querystring');

class AdapterUtils {

    constructor(adapter) {
        this.adapter = adapter;
        this.secret = 'Zgfr56gFe87jJOM';
        this.getSecret()
            .then(secret => this.secret = secret)
            .catch(e => {
            });
    }

    getUuid() {
        return new Promise((resolve, reject) => {
            this.adapter.getForeignObject('system.meta.uuid', (err, obj) => {
                resolve(((obj || {}).native || {}).uuid || '00000000-0000-0000-0000-000000000000');
            });
        });
    }

    getNamespace() {
        return this.adapter?.namespace || 'alexa-cloud.0';
    }

    getSecret() {
        return new Promise((resolve) => {
            this.adapter.getForeignObject('system.meta.uuid', (err, obj) => {
                resolve(((obj || {}).native || {}).secret || 'Zgfr56gFe87jJOM');
            });
        });
    }

    encrypt(value) {
        value = value.toString();
        const key = this.secret;
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
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

    postForm(url, params = {}, header = {}) {
        const body = querystring.stringify(params);
        return this._request('POST', url, body, {
            'Connection': 'Close',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body, 'utf-8'),
            ...header
        });
    }

    postJSON(url, object, header = {}) {
        const body = JSON.stringify(object);
        return this._request('POST', url, body, {
            'Connection': 'Close',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body, 'utf-8'),
            ...header
        });
    }

    _request(method, url, body = null, headers = {}) {
        const uri = new URL(url);
        return new Promise((resolve, reject) => {
            const options = {
                method: method,
                protocol: uri.protocol || 'https:',
                hostname: uri.hostname,
                port: (uri.port || (uri.protocol === 'http:' ? 80 : 443)),
                path: uri.pathname + (uri.search || ''),
                headers: headers
            };
            const protocol = uri.protocol === 'https:' ? https : http;
            const request = protocol.request(options, (response) => {
                let chunks = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    chunks += chunk;
                });
                response.on('end', () => {
                    response.statusCode >= 200 && response.statusCode <= 299 ? resolve(chunks) : reject(chunks);
                });
            });
            request.on('error', reject);
            if (!!body && ['OPTIONS', 'HEAD', 'GET'].indexOf(method) === -1) {
                request.write(body);
            }
            request.end();
        });
    }

    getState(id) {
        return new Promise((resolve, reject) => {
            this.adapter.getForeignState(id, (err, state) => {
                if (!!state && typeof (state) === "object" && state.hasOwnProperty('val')) {
                    resolve(state.val);
                    return;
                }
                reject('BaseDevice.getState.error: ' + id + ': ' + (!!err ? err.toString() : ''));
            });
        });
    }

    setState(id, state) {
        return new Promise((resolve, reject) => {
            this.adapter.setForeignState(id, state, false, (err, id) => {
                if (err) {
                    return reject('BaseDevice.setState.error: ' + (!!err ? err.toString() : ''));
                }
                setTimeout(() => {
                    resolve(id);
                }, 200);
            });
        });
    }

}

module.exports = AdapterUtils;
