'use strict';

const CoreUtils = require('@iobroker/adapter-core');
//const AdapterUtils = require('./AdapterUtils');
//const AlexaBridge = require('./AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({...options, name: 'alexa-cloud'});

        //this.adapterUtils = new AdapterUtils(this);
        this.on("ready", () => { this.onReady(); });
        this.on("message", (message) => { this.onMessage(message); });
        this.on("stateChange", (id, state) => { this.onStateChange(id, state); });
        this.on("unload", (callback) => { this.onUnload(callback); });
    }

    onReady() {
        this.setState('info.connection', false, true);
        /*this.bridge = new AlexaBridge(this, {
            host: this.config.host,
            username: this.config.username,
            password: await this.adapterUtils.decrypt(this.config.password)
        });*/

        this.createDevices('hm-rpc');
        this.createDevices('hue-extended');
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

    createDevices(channel) {
        try {
            this.getForeignObjects(channel + '.*', (err, res) => {
                if (!!err) {
                    throw err
                }
                if (!res) {
                    throw new Error('Could not found any result.');
                }
                console.log('getForeignObjects: ' + JSON.stringify(res));
            });
        } catch (e) {
            this.log.warn('getForeignObjects: '+e.toString());
        }

        try {
            this.getForeignObjects(channel + '.*', 'state', ['rooms', 'functions'], function (err, res) {
                if (!!err) {
                    throw err
                }
                if (!res) {
                    throw new Error('Could not found any result.');
                }
                console.log('getForeignObjects: ' + JSON.stringify(res));
            });
        } catch (e) {
            this.log.warn('getForeignObjects: '+e.toString());
        }

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
                        throw new Error('Could not retrieve MQTT instances!');
                    }
                    instances.rows.forEach(row => {
                        let object = row.value;
                        this.log.info('getObjectView: ' + JSON.stringify({
                            id: row.id.replace('system.adapter.', ''),
                            name: ((object || {}).common || {}).name || 'unknown',
                            type: ((object || {}).native || {}).TYPE || 'unknown',
                            address: ((object || {}).native || {}).ADDRESS || 'unknown',
                        }));
                    });
                }
            );
        } catch (e) {
            this.log.warn('getObjectView: '+e.toString());
        }

        try {
            this.getForeignStates(channel + '.*', (err, res) => {
                if (!err && res) {
                    const keys = Object.keys(res);
                    keys.forEach((id) => {
                        this.log.info('getForeignStates: ' + id);
                        const object = this.getForeignObject(id);
                        if (object.type !== 'device') {
                            return;
                        }
                        this.log.info('getForeignStates: ' + JSON.stringify(
                            ((object || {}).common || {}).name || 'unknown'
                        ));
                    });
                }
            });
        } catch (e) {
            this.log.warn('getForeignStates: '+e.toString());
        }

        // @TODO Tree to Device
        // @TODO Device to Alexa
        //this.subscribeStates(channel + '.*');
    }

}

module.exports = Adapter;
