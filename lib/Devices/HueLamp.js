const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Hue Color Lamp

class HueLamp extends BaseDevice {

    constructor(adapter, object) {
        super(adapter, object);
        this.uniqueid = object.uniqueid;
        this.modelid = object.modelid;
    }

    power(value = null) {
        if (value === null) {
            return this.getState(this.id + '.action.on');
        }
        this.setState(this.id + '.action.on', !!value);
    }

    brightness(value = null) {
        if (value === null) {
            return this.getState(this.id + '.action.brightness').then(value => parseInt(Math.max(0, Math.min(value / 2.54, 100))));
        }
        this.setState(this.id + '.action.brightness', parseInt(Math.max(0, Math.min(value * 2.54, 254))));
    }

    color(value = null) {
        if (value === null) {
            return this.getState(this.id + '.action.hsv')
                .then(value => {
                    let hsv = value.split(',');
                    return {
                        hue: Math.max(0, Math.min(parseFloat(hsv[0]), 360)),
                        saturation: parseInt(hsv[1]) / 100,
                        brightness: parseInt(hsv[2]) / 100
                    };
                });
        }
        /**
         * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-colorcontroller.html#setcolor-directive
         * Important: For the best customer experience, when you make a color change, maintain the current brightness
         * setting of the endpoint. For example, if a lightbulb is currently set to white at 0.5 brightness, and a user
         * requests a color change to red, the SetColor directive specifies hue = 0, saturation = 1, and brightness = 1.
         * In this case, set the hue to 0, the saturation to 1, and ignore the brightness value of 1 in the directive.
         * Instead maintain the current brightness value of 0.5.
         */
        return this.getState(this.id + '.action.hsv').then((current) => {
            this.setState(this.id + '.action.hsv',
                [
                    Math.max(0, Math.min(value.hue, 260)),
                    Math.max(0, Math.min(parseInt(value.saturation * 100), 100)),
                    current.split(',')[2],
                ].join(',')
            );
        });
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
            model: this.modelid,
            friendlyName: this.name,
            description: 'ioBroker - Philips Hue - ' + this.uniqueid,
            displayCategories: ['LIGHT']
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.power(device);
        AlexaCapabilities.brightness(device);
        AlexaCapabilities.color(device);
        try {
            await this.colorTemperature()
            AlexaCapabilities.colorTemperature(device);
        } catch (e) {
            // ignore
        }
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
            namespace: "Alexa.ColorController",
            name: "color",
            value: await this.color(),
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 500
        });
        try {
            context.properties.push({
                namespace: "Alexa.ColorTemperatureController",
                name: "colorTemperatureInKelvin",
                value: await this.colorTemperature(),
                timeOfSample: utc.format(),
                uncertaintyInMilliseconds: 1000
            });
        } catch (e) {
            // ignore
        }
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
