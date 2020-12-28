'use strict';

const CoreUtils = require('@iobroker/adapter-core');
//const AdapterUtils = require('./AdapterUtils');
//const AlexaBridge = require('./AlexaBridge');

class Adapter extends CoreUtils.Adapter {

    constructor(options = {}) {
        super({...options, name: 'iobroker.alexa-cloud'});
        //this.adapterUtils = new AdapterUtils(this);
        this.on("ready", this.onReady.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async onReady() {
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
        this.getForeignObjects(channel + '.*', (err, res) => {
            if (!!err) {
                throw err
            }
            if (!res) {
                throw new Error('Could not found any result.');
            }
            console.log('getForeignObjects: ' + JSON.stringify(res));
        });

        this.getForeignObjects(channel + '.*', 'state', ['rooms', 'functions'], function (err, objs) {
            if (!!err) {
                throw err
            }
            if (!res) {
                throw new Error('Could not found any result.');
            }
            console.log('getForeignObjects: ' + JSON.stringify(res));
        });

        this.objects.getObjectView(
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
                        name: object.common.name,
                        type: object.native.TYPE,
                        address: object.native.ADDRESS,
                    }));
                });
            }
        );

        this.getForeignStates(chanel + '.*', (err, res) => {
            if (!err && res) {
                const keys = Object.keys(res);
                keys.forEach(async (id) => {
                    const object = await getObjectAsync(id);
                    if (object.type !== 'device') {
                        return;
                    }
                    this.log.info('getForeignStates: ' + JSON.stringify(object.common.name));
                });
            }
        });
        // @TODO Tree to Device
        // @TODO Device to Alexa
        //this.subscribeStates(channel + '.*');
    }

}

module.exports = Adapter;
