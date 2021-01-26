const BaseHomeMaticDevice = require('./BaseHomeMaticDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Schalt-Mess-Steckdose

class HMIPPSM extends BaseHomeMaticDevice {

    on() {
        this.setState(this.id + '.3.STATE', true);
    }

    off() {
        this.setState(this.id + '.3.STATE', false);
    }

    status() {
        return this.getState(this.id + '.3.STATE'); // bool
    }

    ampere() {
        return this.getState(this.id + '.6.CURRENT'); // mA
    }

    total() {
        return this.getState(this.id + '.6.ENERGY_COUNTER'); // Wh
    }

    frequency() {
        return this.getState(this.id + '.6.FREQUENCY'); // Hz
    }

    voltage() {
        return this.getState(this.id + '.6.VOLTAGE'); // V
    }

    power() {
        return this.getState(this.id + '.6.POWER'); // W
    }

    unreach() {
        return this.getState(this.id + '.0.UNREACH'); // true = UNREACHABLE, false = OK
    }

    async getAlexaDiscovery() {
        let device = AlexaUtils.buildDevice({
            endpointId: this.endpointId,
            manufacturer: 'ioBroker - HomeMatic IP',
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
            value: await this.status() ? 'ON' : 'OFF',
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

module.exports = HMIPPSM;