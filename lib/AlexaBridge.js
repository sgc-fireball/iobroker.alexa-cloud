const mqtt = require('mqtt')
const uuid = require('uuid').v4;
const crypto = require('crypto');
const AlexaHandles = require('./AlexaHandles');
const AlexaUtils = require('./AlexaUtils');

class AlexaBridge {

    constructor(adapter, {id, host, username, password}) {
        this.adapter = adapter;
        this.id = crypto.createHash('sha256').update(username).digest('hex');
        this.client = mqtt.connect([host], {
            clientId: 'iobroker_' + this.id + '_' + uuid(),
            username: username,
            password: password,
        });
        this.client.on('connect', () => this._onConnect());
        this.client.on('message', (topic, message) => this._onMessage(topic, message));
    }

    _onConnect() {
        this.adapter.setState('info.connection', false, true);
        let channels = {};
        channels[this.id] = {qos: 0};
        channels[this.id + '/#'] = {qos: 0};
        this.client.subscribe(channels, (err) => {
            if (!!err) {
                // @TODO log error
                throw err;
            }
        });
    }

    _onMessage(topic, request) {
        AlexaHandles.handle(request)
            .then((response) => {
                // @TODO log incoming
                this.client.publish(topic, response);
            })
            .catch((e) => {
                // @TODO log error
            });
    }

    proactivelyReport() {
        // @TODO
    }

}
