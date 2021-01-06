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
        return {
            endpointId: device.id || '00000000-0000-0000-0000-000000000000',
            manufacturerName: device.manufacturer || 'iobroker',
            modelName: device.model || 'Model',
            friendlyName: device.friendlyName || 'Friendly Name',
            description: device.description || 'iobroker',
            displayCategories: [], // @TODO
            cookie: {}, // @TODO
            capabilities: [] // @TODO
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
                payload: endpoints
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
                    namespace: 'Alexa.Authorization',
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
