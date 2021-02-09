'use strict';

const adapterName = require('../package.json').name.split('.').pop();
const CoreUtils = require('@iobroker/adapter-core');
const AdapterUtils = require('./AdapterUtils');
const AlexaBridge = require('./Alexa/AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({...options, name: adapterName});
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

    onReady() {
        this.setState('info.connection', false, true);
        this.bridge = new AlexaBridge(this, this.adapterUtils);
        this.subscribeForeignStates('hm-rpc.*');
        this.subscribeForeignStates('hue-extended.*');
        // @TODO this.subscribeForeignStates('onvif.*');
        this.loadDevices();
        this.bridge.refreshAccessToken().catch((e) => {
            if (!!e) {
                this.log.warn(e.toString())
            }
            this.log.warn('Missing account link: No active account linking found.');
            this.log.warn('Missing account link: Please (re)activated your smart home skill.');
        });
    }

    onMessage(message) {
        this.log.info('onMessage: ' + JSON.stringify(message));
    }

    onStateChange(id, state) {
        if (!id || !state) return;
        if (!state.ack) return;

        let deviceId = null;
        if (id.indexOf('hm-rpc.') === 0) {
            deviceId = id.replace(/^(hm-rpc\.[\d]+\.[a-zA-Z0-9]+)(\..*)+/, '$1');
        } else if (id.indexOf('hue-extended.') === 0) {
            deviceId = id.replace(/^(hue-extended\.[\d]+\.lights\.[0-9]{3}[^\.]+)(\..*)+/, '$1');
        } else if (id.indexOf('onvif.') === 0) {
            deviceId = id.replace(/^(onvif\.[\d]+\.[0-9_]+)(\..*)+/, '$1');
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
        return Promise.all([
            this.listHomeMaticDevices(),
            this.listHueDevices(),
            this.listOnvifDevices()
        ]);
    }

    listHomeMaticDevices() {
        return new Promise((resolve) => {
            this.getObjectView(
                adapterName,
                'listHomeMaticDevices',
                null,
                (err, devices) => {
                    if (!!err) {
                        this.log.warn('[listHomeMaticDevices]: ' + err.toString());
                        return resolve();
                    }
                    if (devices && devices.rows) {
                        devices.rows.forEach(device => {
                            device = device.value;
                            if (device.id === device.name) {
                                this.log.warn('Skip device without name: ' + device.address);
                                return;
                            }

                            try {
                                let name = device.type.replace(/-/g, '');
                                device.endpointId = this.adapterUtils.normalizeDeviceId('homematic:' + device.id);
                                if (!this.devices.hasOwnProperty(device.endpointId)) {
                                    let blueprint = require(__dirname + '/Devices/' + name + '.js');
                                    this.devices[device.endpointId] = new blueprint(this, device);
                                }
                            } catch (e) {
                                this.log.debug('[listOnvifDevices]: ' + (!!e ? e.toString() : 'unknown error'));
                            }
                        });
                        this.log.info('[listOnvifDevices]: loaded');
                    }
                    resolve();
                }
            );
        });
    }

    listHueDevices() {
        return new Promise((resolve) => {
            const HueLamp = require(__dirname + '/Devices/HueLamp.js');
            this.getObjectView(
                adapterName,
                'listHueDevices',
                null,
                (err, devices) => {
                    if (!!err) {
                        this.log.warn('[listHueDevices]: ' + err.toString());
                        return resolve();
                    }
                    if (devices && devices.rows) {
                        devices.rows.forEach(device => {
                            device = device.value;
                            this.adapterUtils.getState(device.id + '.modelid').then((modelid) => {
                                this.adapterUtils.getState(device.id + '.uniqueid').then((uniqueid) => {
                                    device.uniqueid = uniqueid;
                                    device.modelid = modelid;
                                    device.endpointId = this.adapterUtils.normalizeDeviceId('hue:' + uniqueid.replace(/:/g, '-'));
                                    if (!this.devices.hasOwnProperty(device.endpointId)) {
                                        this.devices[device.endpointId] = new HueLamp(this, device);
                                    }
                                });
                            });
                        });
                        this.log.info('[listHueDevices]: loaded');
                    }
                    resolve();
                }
            );
        });
    }

    listOnvifDevices() {
        return new Promise((resolve) => {
            const ONVIF = require(__dirname + '/Devices/ONVIF.js');
            this.devices['iobroker:onvif:ipcamera'] = new ONVIF(this, {
                id: 'ipcamera',
                endpointId: 'iobroker:onvif:ipcamera',
            });
            this.log.info('[listOnvifDevices]: loaded');
            resolve();
        });

        /*
        this.getObjectView(
            adapterName,
            'listOnvifDevices',
            null,
            (err, devices) => {
                if (!!err) {
                    this.log.warn('[listOnvifDevices]: ' + err.toString());
                    return
                }
                if (!devices || !Array.isArray(devices.rows) || devices.rows.length === 0) {
                    return;
                }

                const ONVIF = require(__dirname + '/Devices/ONVIF.js');
                devices.rows.forEach(device => {
                    try {
                        this.log.info('ONVIF: ', JSON.stringify(device));
                        device = device.value;
                        device.endpointId = this.adapterUtils.normalizeDeviceId('onvif:' + device.id);
                        if (!this.devices.hasOwnProperty(device.endpointId)) {
                            this.devices[device.endpointId] = new ONVIF(this, device);
                        }
                    } catch (e) {
                        this.log.debug('[listOnvifDevices]: ' + (!!e ? e.toString() : 'unknown error'));
                    }
                });
            }
        );*/
    }

}

module.exports = Adapter;
