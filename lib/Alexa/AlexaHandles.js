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
        this.adapter.log('handleAuthorization: ' + JSON.stringify(request));
        // @TODO
        // jwt.sign({data: 'foobar'}, 'secret', { expiresIn: '1h' }); // @see https://www.npmjs.com/package/jsonwebtoken
        return Promise.resolve(AlexaUtils.response(
            {
                namespace: 'Alexa.Authorization',
                name: 'AcceptGrant.Response',
            },
            {payload: {}}
        ));
    }

    handleDiscovery(request) {
        this.adapter.log('handleDiscovery: ' + JSON.stringify(request));
        return new Promise(async (resolve) => {

            // jwt.verify(token, 'secret') // @see https://www.npmjs.com/package/jsonwebtoken

            /*let userAccessToken = request.directive.payload.scope.token.trim();
            if (!userAccessToken) {
                reject(`Discovery Request [${request.header.messageId}] failed. Invalid access token: ${userAccessToken}`);
            } else {*/
            let endpoints = [];
            for (const device in Object.values(this.adapter.getSupportedDevices())) {
                try {
                    let endpoint = await device.getAlexaDiscovery();
                    if (!!endpoint) {
                        endpoints.push(endpoint);
                    }
                } catch (e) {
                    if (!!e) {
                        this.adapter.log.warn('ERROR: ' + e);
                    }
                }
            }
            resolve(AlexaUtils.discoverResponse(endpoints));
            //}
        });
    }

    handlePowerController(request) {
        // @TODO
        this.adapter.log('handlePower: ' + JSON.stringify(request));
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {messageId: request.directive.header.messageId + '-R',},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['TurnOn', 'TurnOff'].indexOf(request.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {messageId: request.directive.header.messageId + '-R',},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + request.directive.header.name
                ));
                return;
            }

            const device = devices[endpointId];
            if (request.directive.header.name === 'TurnOn') {
                this.adapter.log('Turn on: ' + endpointId);
                await device.on();
            } else if (request.directive.header.name === 'TurnOff') {
                this.adapter.log('Turn off: ' + endpointId);
                await device.off();
            }

            let response = AlexaUtils.event(
                {
                    messageId: request.directive.header.messageId + '-R',
                    correlationToken: request.directive.header.correlationToken,
                },
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: request.directive.endpoint.scope.token
                        },
                    },
                    payload: {}
                }
            );
            response.context = await device.getAlexaContext();
            resolve(response);
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
