const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Klingelsensor

class HmIPDSDPCB extends BaseDevice {

    update(id, state) {
        if (id.indexOf(this.id) !== 0) {
            return;
        }
        this.state[id] = state.val;
        BaseDevice.prototype.update.call(this, id, state);
        /**
         * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-doorbelleventsource.html
         * @TODO send Alexa event
         */
    }

    unreach() {
        return this.getState(this.id + '.0.UNREACH'); // true = UNREACHABLE, false = OK
    }

    async getAlexaDiscovery() {
        let device = AlexaUtils.buildDevice({
            endpointId: this.endpointId,
            manufacturer: 'ioBroker - HomeMatic',
            model: this.type,
            friendlyName: this.name,
            description: 'ioBroker - HomeMatic - ' + this.address,
            displayCategories: ['DOORBELL'],
        });
        AlexaCapabilities.default(device);
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.DoorbellEventSource",
            version: "3",
            proactivelyReported: true
        });
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.clone().utc();
        const context = {properties: []};
        context.properties.push({
            namespace: "Alexa.EndpointHealth",
            name: "connectivity",
            value: {
                value: await this.unreach() ? 'UNREACHABLE' : 'OK',
            },
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 0
        });
        return context;
    }

}

module.exports = HmIPDSDPCB;
