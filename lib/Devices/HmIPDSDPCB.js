const BaseHomeMaticDevice = require('./BaseHomeMaticDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');
const uuid = require('uuid').v4;
const moment = require('moment-timezone');

// Klingelsensor

class HmIPDSDPCB extends BaseHomeMaticDevice {

    update(id, state) {
        if (!super.update(id, state)) {
            return false;
        }
        if (id.indexOf(this.id) === 0 && /\.(PRESS_LONG|PRESS_SHORT|STATE)$/.test(id) && state.val) {
            this.adapter.log.info('Klingelsensor: RING RING RING');
            /**
             * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-doorbelleventsource.html
             */
            this.adapter.bridge.proActiveEvent({
                event: {
                    header: {
                        messageId: uuid(),
                        namespace: "Alexa.DoorbellEventSource",
                        name: "DoorbellPress",
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
                        cause: {
                            type: "PHYSICAL_INTERACTION"
                        },
                        timestamp: moment.utc()
                    }
                },
                context: {},
            }).catch((e) => {
                this.adapter.log.info('HmIPDSDPCB.update..error: ' + JSON.stringify(e));
            });
        }
        return true;
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
            displayCategories: ['DOORBELL'],
        });
        AlexaCapabilities.default(device);
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.DoorbellEventSource",
            version: "3",
            proactivelyReported: false // true
        });
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = this.lastUpdate.clone().utc();
        const context = {properties: []};
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

module.exports = HmIPDSDPCB;
