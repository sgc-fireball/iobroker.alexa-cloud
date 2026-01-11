'use strict';

const adapterName = require('../package.json').name.split('.').pop();
const CoreUtils = require('@iobroker/adapter-core');
const AdapterUtils = require('./AdapterUtils');
const AlexaBridge = require('./Alexa/AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({ ...options, name: adapterName });
        this.devices = {};
        this.bridge = null;
        this.adapterUtils = new AdapterUtils(this);

        this.on("ready", () => this.onReady());
        this.on("message", (message) => this.onMessage(message));
        this.on("stateChange", (id, state) => this.onStateChange(id, state));
        this.on("objectChange", (id, obj) => this.onObjectChange(id, obj));
        this.on("unload", (callback) => this.onUnload(callback));
    }

    getSupportedDevices(id = null) {
        return id === null ? this.devices : (this.devices.hasOwnProperty(id) ? this.devices[id] : null);
    }

    async onReady() {
        this.setState('info.connection', false, true);
        try {
            this.setObjectAsync(this.adapterUtils.getNamespace() + '.onvif', {
                type: 'folder',
                common: { name: 'My Cameras' },
                native: {}
            });
        } catch (e) {
            this.log.warn('Could not create onvif folder: ' + e.message);
        }

        this.bridge = new AlexaBridge(this, this.adapterUtils);
        await this.listDevices();
        this.subscribeForeignStates('hm-rpc.*');
        this.subscribeForeignStates('hue-extended.*');
        this.subscribeForeignStates(this.adapterUtils.getNamespace() + '.onvif.*');
        this.bridge.refreshAccessToken().catch((e) => {
            this.log.warn('Missing account link: No active account linking found.');
            this.log.warn('Missing account link: Please (re)activated your smart home skill.');
            if (!!e) {
                this.log.warn(e.toString())
            }
        });
    }

    onMessage(message) {
        this.log.info('onMessage: ' + JSON.stringify(message));
    }

    onStateChange(id, state) {
        if (!id || !state) return;
        if (!state.ack) return;

        let deviceId = null;
        if (id.startsWith('hm-rpc.')) {
            deviceId = id.replace(/^(hm-rpc\.[\d]+\.[a-zA-Z0-9]+)(\..*)+/, '$1');
        } else if (id.startsWith('hue-extended.')) {
            deviceId = id.replace(/^(hue-extended\.[\d]+\.lights\.[0-9]{3}[^\.]+)(\..*)+/, '$1');
        } else if (id.startsWith(this.adapterUtils.getNamespace() + '.onvif.')) {
            deviceId = this.adapterUtils.getNamespace() + '.onvif.'
                + id
                    .replace(this.adapterUtils.getNamespace() + '.onvif.', '')
                    .replace(/^([^.]+)(\..*)+/, '$1');
        }

        if (!deviceId) return;
        Object.values(this.devices)
            .filter((device) => device.id === deviceId)
            .forEach((device) => device.update(id, state));
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

    listDevices() {
        return new Promise((resolve) => {
            this.log.info('[listDevices]: started');
            /**
             * @link views/listDevices.js
             * @link io-package.json
             */
            this.getObjectView(
                adapterName,
                'listDevices',
                null,
                async (err, devices) => {
                    if (!!err) {
                        this.log.warn('[listDevices]: ' + err.toString());
                        resolve();
                        return
                    }
                    if (!devices || !Array.isArray(devices.rows) || devices.rows.length === 0) {
                        this.log.info('[listDevices]: no devices found');
                        resolve();
                        return;
                    }
                    await Promise.all(devices.rows.map(async (device) => {
                        device = device.value;
                        if (device?._type === 'hm-rpc') {
                            await this.registerHomeMaticDevice(device);
                        } else if (device?._type === 'hue-extended') {
                            await this.registerHueDevice(device);
                        } else if (device?._type === 'onvif') {
                            await this.registerOnvifDevice(device);
                        }
                    }))
                    this.log.info('[listDevices]: loaded');
                    resolve();
                }
            );
        });
    }

    async registerHomeMaticDevice(device) {
        if (!device || typeof device !== 'object') {
            return;
        }
        if (!device?._type || device?._type !== 'hm-rpc') {
            return;
        }
        device.endpointId = this.adapterUtils.normalizeDeviceId('homematic:' + device.id);
        if (this.devices.hasOwnProperty(device.endpointId)) {
            this.log.warn('[registerHomeMaticDevice] already exists: ' + device.id);
            return;
        }

        try {
            const type = device.type.replace(/-/g, '');
            let blueprint = require(__dirname + '/Devices/' + type + '.js');
            this.devices[device.endpointId] = new blueprint(this, device);
            this.log.info('[listHomeMaticDevices] added: ' + device.id);
        } catch (e) {
            this.log.warn('[registerHomeMaticDevice] Device: ' + device.id + ' Error: ' + e.message);
        }
    }

    async registerHueDevice(device) {
        if (!device || typeof device !== 'object') {
            return;
        }
        if (!device?._type || device?._type !== 'hue-extended') {
            return;
        }

        device.uniqueid = await this.adapterUtils.getState(device.id + '.uniqueid');
        device.modelid = await this.adapterUtils.getState(device.id + '.modelid');
        device.endpointId = this.adapterUtils.normalizeDeviceId('hue:' + device.uniqueid.replace(/:/g, '-'));
        if (this.devices.hasOwnProperty(device.endpointId)) {
            this.log.warn('[registerHueDevice] already exists: ' + device.id);
            return;
        }

        try {
            const HueLamp = require(__dirname + '/Devices/HueLamp.js');
            this.devices[device.endpointId] = new HueLamp(this, device);
            this.log.info('[registerHueDevice] added: ' + device.id);
        } catch (e) {
            this.log.warn('[registerHueDevice] Device: ' + device.id + ' Error: ' + e.message);
        }
    }

    async registerOnvifDevice(device) {
        if (!device || typeof device !== 'object') {
            return;
        }
        if (!device?._type || device?._type !== 'onvif') {
            return;
        }

        device.endpointId = this.adapterUtils.normalizeDeviceId('onvif:' + device.id);
        if (this.devices.hasOwnProperty(device.endpointId)) {
            this.log.warn('[registerOnvifDevice] already exists: ' + device.id);
            return;
        }

        try {
            const ONVIF = require(__dirname + '/Devices/ONVIF.js');
            this.devices[device.endpointId] = new ONVIF(this, device);
            this.log.info('[registerOnvifDevice] added: ' + device.id);
        } catch (e) {
            this.log.warn('[registerOnvifDevice] Device: ' + device.id + ' Error: ' + e.message);
        }
    }

}

module.exports = Adapter;
