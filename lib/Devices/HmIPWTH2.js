const BaseHomeMaticDevice = require('./BaseHomeMaticDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Wandthermostat

class HmIPWTH2 extends BaseHomeMaticDevice {

    setTemperature(temperature) {
        this.setState(this.id + '.1.SET_POINT_TEMPERATURE', parseFloat(temperature));
    }

    /*setMode(mode) {
        this.setState(this.id + '.1.STATE', mode);
    }*/

    getTargetTemperature() {
        return this.getState(this.id + '.1.SET_POINT_TEMPERATURE'); // float
    }

    getCurrentTemperature() {
        return this.getState(this.id + '.1.ACTUAL_TEMPERATURE'); // float
    }

    getCurrentHumidity() {
        return this.getState(this.id + '.1.HUMIDITY'); // int %
    }

    /*getMode() {
        return this.getState(this.id + '.1.STATE'); // unknown
    }*/

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
            displayCategories: ['THERMOSTAT', 'TEMPERATURE_SENSOR'],
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
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.ThermostatController",
            version: "3",
            properties: {
                supported: [
                    {name: "targetSetpoint"},
                    {name: "lowerSetpoint"},
                    {name: "upperSetpoint"},
                    //{name: "thermostatMode"}
                ],
                proactivelyReported: false, // true,
                retrievable: true
            },
            configuration: {
                //supportedModes: ["HEAT", "COOL", "AUTO"],
                supportsScheduling: false
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
            namespace: "Alexa.ThermostatController",
            name: "targetSetpoint",
            value: {
                value: await this.getTargetTemperature(),
                scale: "CELSIUS"
            },
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 500
        });
        /*context.properties.push({
            "namespace": "Alexa.ThermostatController",
            "name": "thermostatMode",
            "value": "HEAT",
            "timeOfSample": utc.format(),
            "uncertaintyInMilliseconds": 500
        });*/
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

module.exports = HmIPWTH2;
