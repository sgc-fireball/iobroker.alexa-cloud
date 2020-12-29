'use strict';

const CoreUtils = require('@iobroker/adapter-core');
//const AdapterUtils = require('./AdapterUtils');
//const AlexaBridge = require('./AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({...options, name: 'alexa-cloud'});

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
        this.loadInstances('hm-rpc');
        this.loadInstances('hue-extended');
        this.subscribeStates('*');
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

    loadInstances(channel) {
        this.getObjectView(
            'system',
            'instance',
            {startkey: 'system.adapter.' + channel + '.', endkey: 'system.adapter.' + channel + '.\u9999'},
            (err, instances) => {
                if (instances && instances.rows) {
                    instances.rows.forEach(row => {
                        let instance = row.id.replace('system.adapter.', '');
                        this.log.info('[loadInstances] ' + instance);
                        this.loadDevices(instance);
                    });
                } else {
                    this.log.warn('[loadInstances] Could not found adapter: ' + err);
                }
            }
        );
    }

    loadDevices(instance) {
        /*this.getForeignObjects(instance + '.*', (err, objects) => {
            this.log.info('[loadDevices] ' + JSON.stringify(objects));
            if (typeof(objects) === "object") {
                Object.keys(objects).forEach(key => {
                    let object = objects[key];
                    this.log.info('[loadDevices] ' + key + ': '+JSON.stringify(object));
                });
            } else {
                this.log.warn('[loadDevices] getForeignObjects: ' + err);
            }
        });*/

        this.getObjectView(
            'alexa-cloud',
            'listHomeMaticDevices',
            null,
            (err, devices) => {
                if (devices && devices.rows) {
                    devices.rows.forEach(device => {
                        this.log.info(JSON.stringify(device));
                        let object = device.value;
                        this.log.info('getObjectView: ' + JSON.stringify({
                            id: device.id || 'unknown',
                            name: ((object || {}).common || {}).name || 'unknown',
                            type: ((object || {}).native || {}).TYPE || 'unknown',
                            address: ((object || {}).native || {}).ADDRESS || 'unknown',
                        }));
                    });
                } else {
                    this.log.warn('[loadDevices] getObjectView(alexa-cloud.listHomeMaticDevices): ' + err);
                }
            }
        );
    }

}

module.exports = Adapter;
