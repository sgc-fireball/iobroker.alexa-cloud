'use strict';

const adapterName = require('../package.json').name.split('.').pop();
const CoreUtils = require('@iobroker/adapter-core');
const AdapterUtils = require('./AdapterUtils');
const AlexaBridge = require('./Alexa/AlexaBridge');

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
        this.bridge = new AlexaBridge(this, this.adapterUtils);

        this.setState('info.connection', false, true);
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
        if (!state.ack) return;
        if (id.indexOf('hm-rpc.') === 0) {
            let deviceId = id.replace(/^(hm-rpc\.[\d]+\.[a-zA-Z0-9]+)(\..*)+/, '$1');
            let endpointId = this.adapterUtils.normalizeDeviceId(deviceId);
            if (this.devices.hasOwnProperty(endpointId)) {
                this.devices[endpointId].update(id, state);
            }
        }
        if (id.indexOf('hue-extended.') === 0) {
            let deviceId = id.replace(/^(hue-extended\.[\d]+\.lights\.[a-zA-Z0-9_-])(\..*)+/, '$1');
            let endpointId = this.adapterUtils.normalizeDeviceId(deviceId);
            if (this.devices.hasOwnProperty(endpointId)) {
                this.devices[endpointId].update(id, state);
            }
        }
    }

    onObjectChange(id, obj) {
        if (!id || !obj) return;
        this.log.info('onObjectChange: ' + JSON.stringify(id) + ': ' + JSON.stringify(obj));
    }

    onUnload(callback) {
        this.log.info('onUnload');
        this.bridge && this.bridge.unload();
        callback && callback();
    }

    loadDevices() {
        //this.log.info('[loadDevices] call');
        this.getObjectView(
            adapterName,
            'listHomeMaticDevices',
            null,
            (err, devices) => {
                if (devices && devices.rows) {
                    devices.rows.forEach(device => {
                        device = device.value;
                        if (device.id === device.name) {
                            this.log.warn('Skip device without name: ' + device.address);
                            return;
                        }

                        try {
                            let name = device.type.replace(/-/g, '');
                            let blueprint = require(__dirname + '/HomeMatic/' + name + '.js');
                            device.endpointId = this.adapterUtils.normalizeDeviceId(device.id);
                            if (!this.devices.hasOwnProperty()) {
                                this.devices[device.endpointId] = new blueprint(this, device);
                            }
                        } catch (e) {
                            this.log.warn('Skip device ' + device.id + ' of type ' + device.type + ': ' + e.toString());
                        }
                    });
                    this.log.info('Found ' + Object.keys(this.devices).length + ' devices');
                } else {
                    this.log.warn('[loadDevices] getObjectView(alexa-cloud.listHomeMaticDevices): ' + err);
                }
            }
        );
    }

}

module.exports = Adapter;
