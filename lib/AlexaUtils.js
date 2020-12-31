'use strict';

const uuid = require('uuid').v4;

class AlexaUtils {

    response(header = {}, data = {}) {
        return {
            ...data,
            header: Object.assign({
                messageId: uuid(),
                name: 'Response',
                namespace: 'Alexa',
                payloadVersion: '2',
            }, header),
        };
    }

    event(header = {}, data = {}) {
        return {
            event: this.response(header, data)
        };
    }

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
        return this.event(
            {
                name: 'Discover.Response',
                namespace: 'Alexa.Discovery',
                payloadVersion: '3',
            },
            {payload: endpoints}
        );
    }

}

module.exports = new AlexaUtils();
