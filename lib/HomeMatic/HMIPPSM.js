const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../AlexaUtils');
const AlexaCapabilities = require('../AlexaCapabilities');

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
        this.log.info('set device state' + id);
        this.log.info(JSON.stringify(state));
        this.state[id] = typeof (state) === "object" ? state.val : state;
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
        let device = AlexaUtils.buildDevice({
            id: this.address,
            manufacturer: 'HomeMatic',
            model: this.type,
            friendlyName: this.name,
            description: 'HomeMatic ' + this.type,
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.power(device);
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

}

module.exports = HMIPPSM;
