'use strict';

const CoreUtils = require('@iobroker/adapter-core');
//const AdapterUtils = require('./AdapterUtils');
//const AlexaBridge = require('./AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({...options, name: 'alexa-cloud'});
        this.devices = {};
        //this.adapterUtils = new AdapterUtils(this);

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

    onReady() {
        this.setState('info.connection', false, true);
        /*this.bridge = new AlexaBridge(this, {
            host: this.config.host,
            username: this.config.username,
            password: await this.adapterUtils.decrypt(this.config.password)
        });*/
        this.loadDevices();
        this.subscribeStates('hm-rpc.*');
        this.subscribeStates('hue-extended.*');
        this.setState('info.connection', true, true);
    }

    onMessage(message) {
        this.log.info('onMessage: ' + JSON.stringify(message));
        // this.bridge.event(..);
    }

    onStateChange(id, state) {
        if (!id || !state || state.ack) return;
        this.log.info('onStateChange: ' + id);
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
            'alexa-cloud',
            'listHomeMaticDevices',
            null,
            (err, devices) => {
                if (devices && devices.rows) {
                    devices.rows.forEach(device => {
                        let object = {
                            id: device.id || null,
                            name: (((device.value) || {}).common || {}).name || null,
                            type: (((device.value) || {}).native || {}).TYPE || null,
                            address: (((device.value) || {}).native || {}).ADDRESS || null,
                        };
                        if (object.id === object.name) {
                            console.log('Skip device: ' + object.id);
                            return;
                        }
                        if (object.type) {
                            let name = object.type.replace(/-/g, '');
                            try {
                                let blueprint = require(__dirname + '/HomeMatic/' + name + '.js');
                                this.devices[object.id] = new blueprint(this, object);
                                this.log.info('observe ' + object.address + ' as ' + object.type);
                            } catch (e) {
                                this.log.warn('Unknown device type: ' + object.type);
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
