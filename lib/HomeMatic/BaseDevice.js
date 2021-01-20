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
        this.endpointId = object.endpointId || this.id;
        this.name = object.name;
        this.type = object.type;
        this.address = object.address;
        this.lastUpdate = moment().subtract(1, 'day');
        this.adapter.log.info('Register ' + this.id + ' device as ' + this.type);
    }

    getId() {
        return this.id;
    }

    getState(id) {
        return new Promise((resolve, reject) => {
            this.adapter.getForeignState(id, (err, state) => {
                if (typeof (state) === "object" && state.hasOwnProperty('val')) {
                    resolve(state.val);
                    return;
                }
                reject('BaseDevice.getState.error: ' + (!!err ? err.toString() : ''));
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
        throw new Error(null);
    }

    async getAlexaContext() {
        throw new Error(null);
    }

}

module.exports = BaseDevice;
