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

    onUnload(callback) {
        callback && callback();
    }

    loadInstances(channel) {
        try {
            this.getObjectView(
                'system',
                'instance',
                {startkey: 'system.adapter.' + channel + '.', endkey: 'system.adapter.' + channel + '.\u9999'},
                (err, instances) => {
                    if (!!err) {
                        throw err;
                    }
                    if (!instances || !instances.rows) {
                        throw new Error('Could not retrieve adapter instances!');
                    }
                    instances.rows.forEach(row => {
                        let instance = row.id.replace('system.adapter.', '');
                        this.log.info('loadInstances: ' + instance);
                        this.loadDevices(instance);
                    });
                }
            );
        } catch (e) {
            this.log.warn('getObjectView: ' + e.toString());
        }
    }

    loadDevices(instance) {
        try {
            this.getObjectView(
                instance,
                'device',
                {startkey: instance + '.', endkey: instance + '.\u9999'},
                (err, devices) => {
                    if (!!err) {
                        throw err;
                    }
                    if (!devices || !devices.rows) {
                        this.log.info(JSON.stringify(devices));
                        throw new Error('Could not retrieve adapter instances!');
                    }
                    devices.rows.forEach(device => {
                        this.log.info(JSON.stringify(device));
                    });
                    /*let object = row.value;
                        this.log.info('getObjectView: ' + JSON.stringify({
                            id: row.id.replace('system.adapter.', ''),
                            name: ((object || {}).common || {}).name || 'unknown',
                            type: ((object || {}).native || {}).TYPE || 'unknown',
                            address: ((object || {}).native || {}).ADDRESS || 'unknown',
                        }));*/
                }
            );
        } catch (e) {
            this.log.warn(e.toString());
        }
    }

}

module.exports = Adapter;
