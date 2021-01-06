const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Schalt-Mess-Steckdose

class HMIPPSM extends BaseDevice {

    on() {
        this.setState(this.id + '.2.STATE', true);
    }

    off() {
        this.setState(this.id + '.2.STATE', false);
    }

    update(id, state) {
        if (id.indexOf(this.id) !== 0) {
            return;
        }
        this.state[id] = state.val;
        BaseDevice.prototype.update.call(this, id, state);
    }

    status() {
        return this.getState(this.id + '.2.STATE'); // bool
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
            id: 'HMIP.' + this.address,
            manufacturer: 'HomeMatic',
            model: this.type,
            friendlyName: this.name,
            description: 'HomeMatic ' + this.address,
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.power(device);
        //AlexaCapabilities.endpointHealth(device);
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
        /*context.properties.push({
            namespace: "Alexa.EndpointHealth",
            name: "connectivity",
            value: {
                value: await this.unreach() ? 'UNREACHABLE' : 'OK',
            },
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 0
        });*/
        return context;
    }

}

module.exports = HMIPPSM;
