'use strict';

const adapterName = require('../package.json').name.split('.').pop();
const CoreUtils = require('@iobroker/adapter-core');
const AdapterUtils = require('./AdapterUtils');
const AlexaBridge = require('./AlexaBridge');

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
        this.bridge = new AlexaBridge(this);
        this.loadDevices();
        this.subscribeForeignStates('hm-rpc.*');
        //this.subscribeForeignStates('hue-extended.*');
        this.setState('info.connection', true, true);
    }

    onMessage(message) {
        this.log.info('onMessage: ' + JSON.stringify(message));
    }

    onStateChange(id, state) {
        if (!id || !state) return;
        if (id.indexOf('hm-rpc.') === 0) {
            let deviceId = id.replace(/^(hm-rpc\.[\d]+\.[a-zA-Z0-9]+)(\..*)+/, '$1');
            if (this.devices.hasOwnProperty(deviceId)) {
                this.devices[deviceId].update(id, state);
                this.bridge.report(this.devices[deviceId]);
            }
        }
        if (id.indexOf('hue-extended.') === 0) {
            let deviceId = id.replace(/^(hue-extended\.[\d]+\.lights\.[a-zA-Z0-9_-])(\..*)+/, '$1');
            if (this.devices.hasOwnProperty(deviceId)) {
                this.devices[deviceId].update(id, state);
                this.bridge.report(this.devices[deviceId]);
            }
        }
    }

    onObjectChange(id, obj) {
        if (!id || !obj) return;
        this.log.info('onObjectChange: ' + JSON.stringify(id) + ': ' + JSON.stringify(obj));
    }

    onUnload(callback) {
        this.log.info('onUnload');
        callback && callback();
    }

    loadDevices() {
        this.log.info('[loadDevices] call');
        this.getObjectView(
            adapterName,
            'listHomeMaticDevices',
            null,
            (err, devices) => {
                if (devices && devices.rows) {
                    devices.rows.forEach(device => {
                        device = device.value;
                        if (device.id === device.name) {
                            console.log('Skip device without name: ' + device.address);
                            return;
                        }
                        if (device.type === 'HMIP-PSM') {
                            let name = device.type.replace(/-/g, '');
                            try {
                                let blueprint = require(__dirname + '/HomeMatic/' + name + '.js');
                                this.devices[device.id] = new blueprint(this, device);
                                this.log.info('Load device ' + device.address + ' as ' + device.type);
                            } catch (e) {
                                this.log.warn('Skip currently unsupported device type: ' + device.type);
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
