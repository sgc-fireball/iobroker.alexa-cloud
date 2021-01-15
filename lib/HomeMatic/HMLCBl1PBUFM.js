const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

// Rollladenaktor

class HMLCBl1PBUFM extends BaseDevice {

    percentage(level) {
        this.setState(this.id + '.1.LEVEL', Math.max(0, Math.min(parseInt(level), 100)));
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
            description: 'ioBroker - HomeMatic - ' + this.address,
            displayCategories: ['EXTERIOR_BLIND']
        });
        AlexaCapabilities.default(device);
        /**
         * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-rangecontroller.html#discover-blinds
         */
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.RangeController",
            instance: "Blind.Lift",
            version: "3",
            properties: {
                supported: [
                    {
                        name: "rangeValue"
                    }
                ],
                proactivelyReported: true,
                retrievable: true
            },
            capabilityResources: {
                friendlyNames: [
                    {
                        "@type": "asset",
                        value: {
                            assetId: "Alexa.Setting.Opening"
                        }
                    }
                ]
            },
            configuration: {
                supportedRange: {
                    minimumValue: 0,
                    maximumValue: 100,
                    precision: 1
                },
                unitOfMeasure: "Alexa.Unit.Percent"
            },
            semantics: {
                actionMappings: [
                    {
                        "@type": "ActionsToDirective",
                        actions: ["Alexa.Actions.Close"],
                        directive: {
                            name: "SetRangeValue",
                            payload: {
                                rangeValue: 0
                            }
                        }
                    },
                    {
                        "@type": "ActionsToDirective",
                        actions: ["Alexa.Actions.Open"],
                        directive: {
                            name: "SetRangeValue",
                            payload: {
                                rangeValue: 100
                            }
                        }
                    },
                    {
                        "@type": "ActionsToDirective",
                        actions: ["Alexa.Actions.Lower"],
                        directive: {
                            name: "AdjustRangeValue",
                            payload: {
                                rangeValueDelta: -10,
                                rangeValueDeltaDefault: false
                            }
                        }
                    },
                    {
                        "@type": "ActionsToDirective",
                        actions: ["Alexa.Actions.Raise"],
                        directive: {
                            name: "AdjustRangeValue",
                            payload: {
                                rangeValueDelta: 10,
                                rangeValueDeltaDefault: false
                            }
                        }
                    }
                ],
                stateMappings: [
                    {
                        "@type": "StatesToValue",
                        states: ["Alexa.States.Closed"],
                        value: 0
                    },
                    {
                        "@type": "StatesToRange",
                        states: ["Alexa.States.Open"],
                        range: {
                            minimumValue: 1,
                            maximumValue: 100
                        }
                    }
                ]
            }
        });
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.clone().utc();
        const context = {properties: []};
        context.properties.push({
            namespace: "Alexa.RangeController",
            instance: "Blind.Lift",
            name: "rangeValue",
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
