'use strict';

const uuid = require('uuid').v4;

class AlexaUtils {

    response(header = {}, data = {}) {
        return {
            header: {
                messageId: uuid(),
                name: 'Response',
                namespace: 'Alexa',
                payloadVersion: '3',
                ...header
            },
            ...data
        };
    }

    event(header = {}, data = {}) {
        return {
            event: this.response(header, data)
        };
    }

    eventError(header = {}, data = {}, type = 'INTERNAL_ERROR', message = 'Unknown error.') {
        // @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-errorresponse.html
        data = data || {};
        data.payload = data.payload || {};
        data.payload.type = data.payload.type || type;
        data.payload.message = data.payload.message || message;
        return this.event({...header, name: 'ErrorResponse'}, data);
    };

    buildDevice(device = {}) {
        // @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery-objects.html
        // @see https://www.jsonschemavalidator.net/
        // @see https://raw.githubusercontent.com/alexa/alexa-smarthome/master/validation_schemas/alexa_smart_home_message_schema.json
        return {
            endpointId: device.endpointId.replace(/[^a-zA-Z0-9_\-=#;:?@&]/g, '').substr(0, 256),
            manufacturerName: (device.manufacturer || 'iobroker').substr(0, 128),
            description: (device.description || 'iobroker device').substr(0, 128),
            friendlyName: (device.friendlyName || 'Unknown Device').substr(0, 128),
            additionalAttributes: {
                manufacturer: device.manufacturer.substr(0, 256),
                model: (device.model || 'Unknown Model').substr(0, 256),
                serialNumber: device.endpointId.substr(0, 256),
                firmwareVersion: "1.0.0".substr(0, 256),
                softwareVersion: "1.0.0".substr(0, 256),
                customIdentifier: device.endpointId.substr(0, 256)
            },
            displayCategories: Array.isArray(device.displayCategories) && device.displayCategories.length ? device.displayCategories : ['OTHER'],
            cookie: {}, // max. 5 key value informations
            capabilities: [],
            connections: [],
        };
    }

    /**
     * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html
     */
    discoverResponse(endpoints = []) {
        return {
            event: {
                header: {
                    namespace: 'Alexa.Discovery',
                    name: 'Discover.Response',
                    messageId: uuid(),
                    payloadVersion: '3',
                },
                payload: {
                    endpoints: endpoints
                }
            }
        };
    }

    authorizationAccepted() {
        return {
            event: {
                header: {
                    namespace: 'Alexa.Authorization',
                    name: 'AcceptGrant.Response',
                    messageId: uuid(),
                    payloadVersion: '3',
                },
                payload: {}
            }
        };
    }

    authorizationDenied(err) {
        return {
            event: {
                header: {
                    namespace: 'Alexa',
                    name: 'ErrorResponse',
                    messageId: uuid(),
                    payloadVersion: '3',
                },
                payload: {
                    type: "ACCEPT_GRANT_FAILED",
                    message: err || 'Unknown access error.'
                }
            }
        };
    }

}

module.exports = new AlexaUtils();
