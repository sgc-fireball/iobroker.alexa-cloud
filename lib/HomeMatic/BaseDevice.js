const moment = require('moment-timezone');

class BaseDevice {

    /**
     *
     * @param {Adapter} adapter
     * @param {Object} object
     */
    constructor(adapter, object) {
        this.adapter = adapter;
        this.id = object.id;
        this.name = object.name;
        this.type = object.type;
        this.address = object.address;
        this.state = {};
        this.lastUpdate = null;
    }

    getState(id) {
        if (this.state.hasOwnProperty(id)) {
            return Promise.resolve(this.state[id]);
        }
        return new Promise((resolve, reject) => {
            this.adapter.getState(id, (err, state) => {
                if (state) {
                    this.state[id] = state.val;
                    resolve(this.state[id]);
                    return;
                }
                reject(err);
            });
        });
    }

    setState(id, state) {
        return new Promise((resolve, reject) => {
            this.adapter.setState(id, state, ack, (err, id) => {
                if (err) {
                    return reject(err);
                }
                this.state[id] = state;
                resolve(id);
            });
        });
    }

    update(id, state) {
        this.lastUpdate = moment();
    }

    getAlexaDiscovery() {
        return Promise.reject('Not supported.');
    }

    getAlexaContext() {
        return Promise.reject('Not supported.');
    }

}

module.exports = BaseDevice;
