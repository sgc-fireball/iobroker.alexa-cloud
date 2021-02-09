const moment = require('moment-timezone');

class BaseDevice {

    /**
     *
     * @param {Adapter} adapter
     * @param {Object} object
     */
    constructor(adapter, object) {
        this.adapter = adapter;
        this.id = object.id || object._id;
        this.endpointId = object.endpointId;
        this.name = object.name || this.endpointId;
        this.lastUpdate = moment().subtract(1, 'day');
    }

    getId() {
        return this.id;
    }

    getEndpointId() {
        return this.endpointId;
    }

    getState(id) {
        return this.adapter.adapterUtils.getState(id);
    }

    setState(id, state) {
        return this.adapter.adapterUtils.setState(id, state);
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
