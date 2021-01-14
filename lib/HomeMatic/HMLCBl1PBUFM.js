const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Rollladenaktor

class HMLCBl1PBUFM extends BaseDevice {

    percentage(level) {
        this.setState(this.id + '.1.LEVEL', parseInt(level));
    }

    update(id, state) {
        if (id.indexOf(this.id) !== 0) {
            return;
        }
        this.state[id] = state.val;
        BaseDevice.prototype.update.call(this, id, state);
    }

    level() {
        return this.getState(this.id + '.1.LEVEL'); // number
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
            displayCategories: ['EXTERIOR_BLIND']
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.percentage(device);
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.clone().utc();
        const context = {properties: []};
        context.properties.push({
            namespace: "Alexa.PercentageController",
            name: "percentage",
            value: await this.level(),
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

module.exports = HMLCBl1PBUFM;
