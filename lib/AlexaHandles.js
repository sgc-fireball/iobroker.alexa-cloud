const AlexaUtils = require('./AlexaUtils');
const jwt = require('jsonwebtoken');

class AlexaHandles {

    constructor(adapter) {
        this.adapter = adapter;
    }

    handleRequest(request) {
        let namespace = (((request || {}).directive || {}).header || {}).namespace || 'Alexa.Unknown';
        let method = 'handle' + namespace.replace('Alexa.', '').replace(/\\./g, '');
        if (this.hasOwnProperty(method)) {
            return this[method](request);
        }
        return this.handleUnknown(request);
    }

    handleEvent(event) {
        let name = ((event || {}).header || {}).name || 'Unknown';
        let method = 'handle' + name;
        if (this.hasOwnProperty(method)) {
            return this[method](event);
        }
        return this.handleUnknown(event);
    }

    handleUnknown(request) {
        this.adapter.log('handleUnknown: ' + JSON.stringify(request));
        return Promise.reject('No supported alexa handle.');
    }

    handleAuthorization(request) {
        // jwt.sign({data: 'foobar'}, 'secret', { expiresIn: '1h' }); // @see https://www.npmjs.com/package/jsonwebtoken
        this.adapter.log('handleAuthorization: ' + JSON.stringify(request));
        return Promise.reject('Currently unsupported handleAuthorization');
    }

    handleDiscovery(request) {
        this.adapter.log('handleDiscovery: ' + JSON.stringify(request));
        return new Promise((resolve, reject) => {

            // jwt.verify(token, 'secret') // @see https://www.npmjs.com/package/jsonwebtoken

            /*let userAccessToken = request.directive.payload.scope.token.trim();
            if (!userAccessToken) {
                reject(`Discovery Request [${request.header.messageId}] failed. Invalid access token: ${userAccessToken}`);
            } else {*/
            let endpoints = [];
            Object.values(this.adapter.getSupportedDevices()).forEach((device) => {
                let endpoint = device.getAlexaDiscovery();
                if (!!endpoint) {
                    endpoints.push(endpoint);
                }
            });
            resolve(AlexaUtils.discoverResponse(endpoints));
            //}
        });
    }

    handlePowerController(request) {
        // @TODO
        this.adapter.log('handlePower: ' + JSON.stringify(request));
        return new Promise((resolve, reject) => {
            let endpointId = request.directive.endpoint.endpointId;
            if (request.directive.header.name === 'TurnOn') {
                this.adapter.log('Turn on: ' + endpointId);
                let response = null; // @TODO
                resolve(response);
            } else if (request.directive.header.name === 'TurnOff') {
                this.adapter.log('Turn off: ' + endpointId);
                let response = AlexaUtils.event(
                    {
                        payloadVersion: '3',
                        messageId: request.directive.header.messageId + '-R',
                    },
                    {
                        endpoint: {
                            scope: {
                                type: "BearerToken",
                                token: request.directive.endpoint.scope.token
                            }
                        },
                        payload: {}
                    }
                );
                response.context = {
                    properties: {
                        // @TODO
                    }
                };
                resolve(response);
            } else {
                reject('Currently unsupported handlePower')
            }
        });
    }

    handleReportState(event) {
        this.adapter.log('handleReportState: ' + JSON.stringify(event));
        return new Promise((resolve, reject) => {
            let endpointId = event.event.header.endpoint.endpointId;
            reject('Currently unsupported handleReportState')
        });
    }

}

module.exports = AlexaHandles;
