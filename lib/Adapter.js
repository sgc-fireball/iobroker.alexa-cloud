'use strict';

const adapterName = require('../package.json').name.split('.').pop();
const CoreUtils = require('@iobroker/adapter-core');
const AdapterUtils = require('./AdapterUtils');

//const AlexaBridge = require('./AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({...options, name: adapterName});
        this.devices = {};
        this.adapterUtils = new AdapterUtils(this);

        this.on("ready", () => {
            this.onReady();
        });
        this.on("message", (message) => {
            this.onMessage(message);
        });
        this.on("stateChange", (id, state) => {
            this.onStateChange(id, state);
        });
        this.on("objectChange", (id, obj) => {
            this.onObjectChange(id, obj);
        });
        this.on("unload", (callback) => {
            this.onUnload(callback);
        });
    }

    getSupportedDevices() {
        return this.devices;
    }

    onReady() {
        this.setState('info.connection', false, true);
        /*this.bridge = new AlexaBridge(this, {
            host: this.config.host,
            username: this.config.username,
            password: await this.adapterUtils.decrypt(this.config.password)
        });*/
        this.loadDevices();
        this.subscribeForeignObjects('hm-rpc.*');
        //this.subscribeForeignObjects('hue-extended.*'); // @TODO
        this.setState('info.connection', true, true);
    }

    onMessage(message) {
        this.log.info('onMessage: ' + JSON.stringify(message));
        // this.bridge.event(..);
    }

    onStateChange(id, state) {
        if (!id || !state || state.ack) return;
        this.log.info('onStateChange: ' + id);
        if (id.substr('hm-rpc.') === 0) {
            this.log.info('received updated for hm-rpc: ' + id);
            let deviceId = id.replace(/^(hm-rpc\.[\d]+\.[a-zA-Z0-9])(\..*)+/, '\\1');
            if (this.devices.hasOwnProperty(deviceId)) {
                this.log.info('device found and supported: ' + id);
                this.device.update(id, state);
            }
        }
        /*if (id.substr('hue-extended.') === 0) { // @TODO
            let deviceId = id.replace(/^(hue-extended\.[\d]+\.lights\.[a-zA-Z0-9_-])(\..*)+/, '\\1');
            if (this.devices.hasOwnProperty(deviceId)) {
                this.device.update(id, state);
            }
        }*/
    }

    onObjectChange(id, obj) {
        if (!id || !obj) return;
        this.log.info('onObjectChange: ' + id);
    }

    onUnload(callback) {
        this.log.info('onUnload');
        callback && callback();
    }

    loadDevices() {
        this.getObjectView(
            adapterName,
            'listHomeMaticDevices',
            null,
            (err, devices) => {
                if (devices && devices.rows) {
                    devices.rows.forEach(device => {
                        let object = { // @TODO refactor to view
                            id: device.id || null,
                            name: (((device.value) || {}).common || {}).name || null,
                            type: (((device.value) || {}).native || {}).TYPE || null,
                            address: (((device.value) || {}).native || {}).ADDRESS || null,
                        };
                        if (!object.name) {
                            // Skip, it is not a device.
                            return;
                        }
                        if (object.id === object.name) {
                            console.log('Skip device without name: ' + object.address);
                            return;
                        }
                        if (object.type && object.type === 'HMIP-PSM') {
                            let name = object.type.replace(/-/g, '');
                            try {
                                let blueprint = require(__dirname + '/HomeMatic/' + name + '.js');
                                this.devices[object.id] = new blueprint(this, object);
                                this.log.info('Load device ' + object.address + ' as ' + object.type);

                                this.devices[object.id].getAlexaDiscovery();
                            } catch (e) {
                                this.log.warn('Skip currently unsupported device type: ' + object.type);
                            }
                        }
                    });
                } else {
                    this.log.warn('[loadDevices] getObjectView(alexa-cloud.listHomeMaticDevices): ' + err);
                }
            }
        );
    }

}

module.exports = Adapter;
