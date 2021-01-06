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

    eventError(header = {}, data = {}, type, message) {
        // @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-errorresponse.html
        data = data || {};
        data.payload = data.payload || {};
        data.payload.type = data.payload.type || 'INTERNAL_ERROR';
        data.payload.message = data.payload.message || 'Unknown error.';
        return this.event({...header, name: 'ErrorResponse'}, data);
    };

    buildDevice(device = {}) {
        // @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery-objects.html
        return {
            endpointId: device.endpointId.substr(0,256),
            manufacturerName: (device.manufacturer || 'iobroker').replace(/[^a-zA-Z0-9\s]+/g, 'X').substr(0, 128),
            description: (device.description || 'iobroker device').replace(/[^a-zA-Z0-9\s]+/g, 'X').substr(0, 128),
            friendlyName: (device.friendlyName || 'Unknown Device').replace(/[^a-zA-Z0-9\s]+/g, 'X').substr(0, 128),
            additionalAttributes: {
                manufacturer: device.manufacturer || 'iobroker',
                model: device.model || 'Unknown Model',
                serialNumber: device.id,
                firmwareVersion: "1.0.0",
                softwareVersion: "1.0.0",
                customIdentifier: device.id
            },
            displayCategories: ['OTHER'], // @TODO
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
