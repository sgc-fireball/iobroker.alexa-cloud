const moment = require('moment-timezone');

class BaseDevice {

    /**
     *
     * @param {Adapter} adapter
     * @param {Object} object
     */
    constructor(adapter, object) {
        this.id = object.id || object._id;
        this.endpointId = object.endpointId;
        this.lastUpdate = moment().subtract(1, 'day');
    }

    getId() {
        return this.id;
    }

    getEndpointId() {
        return this.endpointId;
    }

    getState(id) {
        return new Promise((resolve, reject) => {
            this.adapter.getForeignState(id, (err, state) => {
                if (!!state && typeof (state) === "object" && state.hasOwnProperty('val')) {
                    resolve(state.val);
                    return;
                }
                reject('BaseDevice.getState.error: ' + id + ': ' + (!!err ? err.toString() : ''));
            });
        });
    }

    setState(id, state) {
        return new Promise((resolve, reject) => {
            this.adapter.setForeignState(id, state, false, (err, id) => {
                if (err) {
                    return reject('BaseDevice.setState.error: ' + (!!err ? err.toString() : ''));
                }
                setTimeout(() => {
                    resolve(id);
                }, 200);
            });
        });
    }

    update(id, state) {
        if (id.indexOf(this.id) !== 0) {
            return false;
        }
        this.lastUpdate = moment(state.ts);
        return true;
    }

    async getAlexaDiscovery() {
        throw new Error('Currently not supported.');
    }

    async getAlexaContext() {
        throw new Error('Currently not supported.');
    }

}

module.exports = BaseDevice;
