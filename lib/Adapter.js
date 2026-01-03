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

    loadDevices() {
        this.log.info('[loadDevices]: DEPRECATED');

        return Promise.all([
            this.listHomeMaticDevices(),
            this.listHueDevices(),
            this.listOnvifDevices()
        ]);
    }

    listHomeMaticDevices() {
        this.log.info('[listHomeMaticDevices]: DEPRECATED');

        return new Promise((resolve) => {
            this.log.info('[listHomeMaticDevices]: started');
            /**
             * @link views/listHomeMaticDevices.js
             * @link io-package.json
             */
            this.getObjectView(
                adapterName,
                'listHomeMaticDevices',
                null,
                (err, devices) => {
                    if (!!err) {
                        this.log.warn('[listHomeMaticDevices]: ' + err.toString());
                        return resolve();
                    }
                    if (!devices || !Array.isArray(devices.rows) || devices.rows.length === 0) {
                        this.log.info('[listHomeMaticDevices]: no devices found');
                        resolve();
                        return;
                    }
                    devices.rows.forEach(device => {
                        try {
                            device = device.value;
                            if (device._type !== 'hm-rpc') {
                                return;
                            }
                            if (device.id === device.name) {
                                this.log.warn('Skip device without name: ' + device.address);
                                return;
                            }
                            let name = device.type.replace(/-/g, '');
                            device.endpointId = this.adapterUtils.normalizeDeviceId('homematic:' + device.id);
                            if (!this.devices.hasOwnProperty(device.endpointId)) {
                                let blueprint = require(__dirname + '/Devices/' + name + '.js');
                                this.log.info('[listHomeMaticDevices] found: ' + device.id);
                                this.devices[device.endpointId] = new blueprint(this, device);
                            }
                        } catch (e) {
                            this.log.debug('[listHomeMaticDevices]: ' + (!!e ? e.toString() : 'unknown error'));
                        }
                    });
                    this.log.info('[listHomeMaticDevices]: loaded');
                    resolve();
                }
            );
        });
    }

    listHueDevices() {
        this.log.info('[listHueDevices]: DEPRECATED');

        return new Promise((resolve) => {
            this.log.info('[listHueDevices]: started');
            /**
             * @link views/listHueDevices.js
             * @link io-package.json
             */
            this.getObjectView(
                adapterName,
                'listHueDevices',
                null,
                (err, devices) => {
                    if (!!err) {
                        this.log.warn('[listHueDevices]: ' + err.toString());
                        resolve();
                        return
                    }
                    if (!devices || !Array.isArray(devices.rows) || devices.rows.length === 0) {
                        this.log.info('[listHueDevices]: no devices found');
                        resolve();
                        return;
                    }
                    const HueLamp = require(__dirname + '/Devices/HueLamp.js');
                    devices.rows.forEach(device => {
                        device = device.value;
                        if (device._type !== 'hue-extended') {
                            return;
                        }
                        this.adapterUtils.getState(device.id + '.modelid').then((modelid) => {
                            this.adapterUtils.getState(device.id + '.uniqueid').then((uniqueid) => {
                                device.uniqueid = uniqueid;
                                device.modelid = modelid;
                                device.endpointId = this.adapterUtils.normalizeDeviceId('hue:' + uniqueid.replace(/:/g, '-'));
                                if (!this.devices.hasOwnProperty(device.endpointId)) {
                                    this.log.info('[listHueDevices] found: ' + device.id);
                                    this.devices[device.endpointId] = new HueLamp(this, device);
                                }
                            }).catch(e => {
                                this.log.warn('[listHueDevices]: ' + (!!e ? JSON.stringify(e) : 'unknown error'));
                            });
                        }).catch(e => {
                            this.log.warn('[listHueDevices]: ' + (!!e ? JSON.stringify(e) : 'unknown error'));
                        });
                    });
                    this.log.info('[listHueDevices]: loaded');
                    resolve();
                }
            );
        });
    }

    listOnvifDevices() {
        this.log.info('[listOnvifDevices]: DEPRECATED');

        return new Promise((resolve) => {
            this.log.info('[listOnvifDevices]: started');
            /**
             * @link views/listOnvifDevices.js
             * @link io-package.json
             */
            this.getObjectView(
                adapterName,
                'listOnvifDevices',
                null,
                (err, devices) => {
                    if (!!err) {
                        this.log.warn('[listOnvifDevices]: ' + err.toString());
                        resolve();
                        return
                    }
                    if (!devices || !Array.isArray(devices.rows) || devices.rows.length === 0) {
                        this.log.info('[listOnvifDevices]: no devices found');
                        resolve();
                        return;
                    }
                    const ONVIF = require(__dirname + '/Devices/ONVIF.js');
                    devices.rows.forEach(device => {
                        try {
                            device = device.value;
                            if (device._type !== 'onvif') {
                                return;
                            }
                            // ensure that the onvif definition comes from our alexa-cloud instance
                            if (!device.id.startsWith(this.adapterUtils.getNamespace() + '.onvif.')) {
                                return;
                            }
                            this.log.info('[listOnvifDevices] found: ' + JSON.stringify(device));
                            device.endpointId = this.adapterUtils.normalizeDeviceId('onvif:' + device.id);
                            if (!this.devices.hasOwnProperty(device.endpointId)) {
                                this.log.info('[listOnvifDevices] found: ' + device.id);
                                this.devices[device.endpointId] = new ONVIF(this, device);
                            }
                        } catch (e) {
                            this.log.debug('[listOnvifDevices]: ' + (!!e ? e.toString() : 'unknown error'));
                        }
                    });
                    this.log.info('[listOnvifDevices]: loaded');
                    resolve();
                }
            );
        });
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
                (err, devices) => {
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
                    devices.rows.forEach(device => {
                        device = device.value;
                        if (device?._type === 'hm-rpc') {
                            this.registerHomeMaticDevice(device);
                        } else if (device?._type === 'hue-extended') {
                            this.registerHueDevice(device);
                        } else if (device?._type === 'onvif') {
                            this.registerOnvifDevice(device);
                        }
                    })
                }
            );
            this.log.info('[listDevices]: loaded');
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

        device.uniqueid = this.adapterUtils.getState(device.id + '.uniqueid');
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
