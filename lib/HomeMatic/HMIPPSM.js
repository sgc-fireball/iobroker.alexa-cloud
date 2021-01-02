const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../AlexaUtils');
const AlexaCapabilities = require('../AlexaCapabilities');
const moment = require('moment-timezone');

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
        this.adapter.log.info(JSON.stringify(state));
        this.state[id] = state.val;
        BaseDevice.prototype.update.call(this, id, state);
    }

    state() {
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

    getAlexaDiscovery() {
        return new Promise((resolve) => {
            let device = AlexaUtils.buildDevice({
                id: this.id,
                manufacturer: 'HomeMatic - eQ-3',
                model: this.type,
                friendlyName: this.name,
                description: 'HomeMatic: ' + this.address,
            });
            AlexaCapabilities.default(device);
            AlexaCapabilities.power(device);
            AlexaCapabilities.endpointHealth(device);
            resolve(device);
        });
    }

    getAlexaContext() {
        return new Promise(async (resolve) => {
            let utc = this.lastUpdate.clone().utc();
            let context = {properties: []};
            context.push({
                namespace: "Alexa.PowerController",
                name: "powerState",
                value: await this.state() ? 'ON' : 'OFF',
                timeOfSample: utc.format(),
                uncertaintyInMilliseconds: 500
            });
            context.push({
                namespace: "Alexa.EndpointHealth",
                name: "connectivity",
                value: {
                    value: await this.unreach() ? 'UNREACHABLE' : 'OK',
                },
                timeOfSample: utc.format(),
                uncertaintyInMilliseconds: 0
            });
            resolve(context);
        });
    }

}

module.exports = HMIPPSM;
