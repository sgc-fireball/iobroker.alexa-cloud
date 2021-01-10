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
        this.state = {};
        this.lastUpdate = moment().subtract(1, 'day');
    }

    getState(id) {
        if (this.state.hasOwnProperty(id)) {
            return Promise.resolve(this.state[id]);
        }
        return new Promise((resolve, reject) => {
            this.adapter.getForeignState(id, (err, state) => {
                if (state) {
                    this.state[id] = state.val;
                    resolve(this.state[id]);
                    return;
                }
                reject('BaseDevice.getState.error: ' + err);
            });
        });
    }

    setState(id, state) {
        return new Promise((resolve, reject) => {
            this.adapter.setForeignState(id, state, false, (err, id) => {
                if (err) {
                    return reject(err);
                }
                /**
                 * wait a few seconds that the bridges can work
                 * an transmit the command to the device and back again
                 */
                setTimeout(() => {
                    resolve(id);
                }, 200);
            });
        });
    }

    update(id, state) {
        this.lastUpdate = moment(state.ts);
    }

    // @see https://developer.amazon.com/en-US/docs/alexa/alexa-gadgets-toolkit/gadget-id-requirements.html
    async getAlexaDiscovery() {
        throw new Error(null);
    }

    async getAlexaContext() {
        throw new Error(null);
    }

}

module.exports = BaseDevice;
