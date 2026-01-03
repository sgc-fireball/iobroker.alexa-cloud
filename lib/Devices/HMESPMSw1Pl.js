const BaseHomeMaticDevice = require('./BaseHomeMaticDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Steckdose Mess und Schaltaktor

class HMESPMSw1Pl extends BaseHomeMaticDevice {

    power(value = null) {
        if (value === null) {
            return this.getState(this.id + '.1.STATE');
        }
        this.setState(this.id + '.1.STATE', !!value);
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
            description: 'ioBroker - HomeMatic - '+this.address,
            displayCategories: ['SMARTPLUG']
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.power(device);
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.clone().utc();
        const context = {properties: []};
        context.properties.push({
            namespace: "Alexa.PowerController",
            name: "powerState",
            value: await this.power() ? 'ON' : 'OFF',
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 500
        });
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

module.exports = HMESPMSw1Pl;
