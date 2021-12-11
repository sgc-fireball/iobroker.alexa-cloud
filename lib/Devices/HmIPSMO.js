const BaseHomeMaticDevice = require('./BaseHomeMaticDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');
const moment = require('moment-timezone');

// Außen Bewegungsmelder

class HmIPSMO extends BaseHomeMaticDevice {

    update(id, state) {
        if (!super.update(id, state)) {
            return false;
        }
        if (id.indexOf(this.id) === 0 && /\.(MOTION)$/.test(id) && state.val) {
            this.adapter.log.info('Bewegungsmelder: Bewegung');
            /**
             * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-doorbelleventsource.html
             */
            this.getAlexaContext()
                .then((context) => {
                    return this.adapter.bridge.proActiveEvent({
                        event: {
                            header: {
                                messageId: uuid(),
                                namespace: "Alexa",
                                name: "ChangeReport",
                                payloadVersion: "3"
                            },
                            endpoint: {
                                scope: {
                                    type: "BearerToken",
                                    token: "access-token-from-Amazon"
                                },
                                endpointId: this.endpointId
                            },
                            payload: {
                                change: {
                                    cause: {
                                        type: "PHYSICAL_INTERACTION"
                                    },
                                    properties: [
                                        {
                                            namespace: "Alexa.MotionSensor",
                                            name: "detectionState",
                                            value: state.val ? "DETECTED" : "NOT_DETECTED",
                                            timeOfSample: moment().utc(),
                                            uncertaintyInMilliseconds: 0
                                        }
                                    ]
                                }
                            }
                        },
                        context: context
                    });
                })
                .catch((e) => {
                    this.adapter.log.info('HmIPSMO.update.error: ' + JSON.stringify(e));
                });
        }
        return true;
    }

    motion() {
        return this.getState(this.id + '.1.MOTION'); // true = DETECTED, false = NOT_DETECTED
    }

    illumination() {
        return this.getState(this.id + '.1.ILLUMINATION'); // int
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
            displayCategories: ['MOTION_SENSOR'],
        });
        AlexaCapabilities.default(device);
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.MotionSensor",
            version: "3",
            properties: {
                supported: [
                    {name: "detectionState"}
                ],
                proactivelyReported: true,
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
            namespace: "Alexa.MotionSensor",
            name: "detectionState",
            value: await this.motion() ? 'DETECTED' : 'NOT_DETECTED',
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 0
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

module.exports = HmIPSMO;
