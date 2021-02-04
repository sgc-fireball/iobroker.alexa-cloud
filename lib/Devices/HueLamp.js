const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');
const moment = require('moment-timezone');

// IP Camera

class HueLamp extends BaseDevice {

    constructor(adapter, object) {
        super(adapter, object);
    }

    power(value = null) {
        if (value === null) {
            return this.getState(this.id + '.action.on');
        }
        this.setState(this.id + '.action.on', !!value);
    }

    brightness(value = null) {
        if (value === null) {
            return this.getState(this.id + '.action.brightness').then(value => parseInt(value / 2.55));
        }
        this.setState(this.id + '.action.brightness', Math.max(0, Math.min(value * 2.55, 255)));
    }

    colorTemperature(value = null) {
        if (value === null) {
            return this.getState(this.id + '.action.colorTemperature');
        }
        this.setState(this.id + '.action.colorTemperature', Math.max(2000, Math.min(value, 6500)));
    }

    async getAlexaDiscovery() {
        let device = AlexaUtils.buildDevice({
            endpointId: this.endpointId,
            manufacturer: 'ioBroker - Philips Hue',
            model: 'IPC',
            friendlyName: this.name || this.endpointId,
            description: 'ioBroker - Philips Hue',
            displayCategories: ['LIGHT']
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.power(device);
        AlexaCapabilities.brightness(device);
        AlexaCapabilities.colorTemperature(device);
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.utc();
        const context = {properties: []};
        context.properties.push({
            namespace: "Alexa.PowerController",
            name: "powerState",
            value: await this.power() ? 'ON' : 'OFF',
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 500
        });
        context.properties.push({
            namespace: "Alexa.BrightnessController",
            name: "brightness",
            value: await this.brightness(),
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 1000
        });
        context.properties.push({
            namespace: "Alexa.ColorTemperatureController",
            name: "colorTemperatureInKelvin",
            value: await this.colorTemperature(),
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 1000
        });
        context.properties.push({
            namespace: "Alexa.EndpointHealth",
            name: "connectivity",
            value: {
                value: 'OK',
            },
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 0
        });
        return context;
    }

}

module.exports = HueLamp;
