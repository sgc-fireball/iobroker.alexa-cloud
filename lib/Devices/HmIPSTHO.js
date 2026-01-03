const BaseHomeMaticDevice = require('./BaseHomeMaticDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Aussentemperatur

class HmIPSTHO extends BaseHomeMaticDevice {

    getCurrentTemperature() {
        return this.getState(this.id + '.1.ACTUAL_TEMPERATURE'); // float
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
            displayCategories: ['TEMPERATURE_SENSOR'],
        });
        AlexaCapabilities.default(device);
        /**
         * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-temperaturesensor.html
         */
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.TemperatureSensor",
            version: "3",
            properties: {
                supported: [
                    {name: "temperature"}
                ],
                proactivelyReported: false, // true,
                retrievable: true
            }
        });
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.clone().utc();
        const context = {properties: []};
        context.properties.push({
            namespace: "Alexa.TemperatureSensor",
            name: "temperature",
            value: {
                value: await this.getCurrentTemperature(),
                scale: "CELSIUS"
            },
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

module.exports = HmIPSTHO;
