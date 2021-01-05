const AlexaUtils = require('./AlexaUtils');
const jwt = require('jsonwebtoken');

class AlexaHandles {

    constructor(adapter) {
        this.adapter = adapter;
    }

    handle(request) {
        let promise;
        this.adapter.log.info('Request: ' + JSON.stringify(request));
        if (!!request.directive) {
            promise = this.handleRequest(request);
        }
        if (!!request.event) {
            promise = this.handleEvent(request);
        }
        if (promise) {
            return promise
                .then((response) => {
                    this.adapter.log.info('Response: ' + JSON.stringify(response));
                    return response;
                });
        }
        return this.handleUnknown(request);
    }

    handleRequest(request) {
        let namespace = (((request || {}).directive || {}).header || {}).namespace || 'Alexa.Unknown';
        let method = 'handle' + namespace.replace('Alexa.', '').replace(/\\./g, '');
        if (typeof (this[method]) === "function") {
            return this[method](request);
        }
        return this.handleUnknown(request);
    }

    handleEvent(event) {
        let name = ((event || {}).header || {}).name || 'Unknown';
        let method = 'handle' + name;
        if (typeof (this[method]) === "function") {
            return this[method](event);
        }
        return this.handleUnknown(event);
    }

    handleUnknown(request) {
        return Promise.reject('handleUnknown: Unknown handle: ' + JSON.stringify(request));
    }

    handleAuthorization(request) {
        // @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-authorization.html
        this.adapter.log.info('handleAuthorization: ' + JSON.stringify(request));
        return new Promise((resolve, reject) => {
            if (request.directive.header.name !== 'AcceptGrant') {
                reject('Invalid request.directive.header.name: ' + request.directive.header.name);
                return;
            }
            if (request.directive.payload.grantee.type !== 'BearerToken') {
                reject('Invalid request.directive.payload.grantee.type: ' + request.directive.payload.grantee.type);
                return;
            }

            const type = request.directive.payload.grant.type; // OAuth2.AuthorizationCode
            const code = request.directive.payload.grant.code;
            const token = jwt.verify(request.directive.payload.grantee.token, this.adapter.config.oauth_secret);

            resolve(AlexaUtils.event(
                {
                    namespace: 'Alexa.Authorization',
                    name: 'AcceptGrant.Response',
                },
                {payload: {}}
            ));
        });
    }

    handleDiscovery(request) {
        this.adapter.log.info('handleDiscovery: ' + JSON.stringify(request));
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
                        this.adapter.log.warn('handleDiscovery.Error: ' + e);
                    }
                }
            }
            resolve(AlexaUtils.discoverResponse(endpoints));
            //}
        });
    }

    handlePowerController(request) {
        // @TODO
        this.adapter.log.info('handlePower: ' + JSON.stringify(request));
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log.info('Unknown device: ' + endpointId);
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
                this.adapter.log.info('Turn on: ' + endpointId);
                await device.on();
            } else if (request.directive.header.name === 'TurnOff') {
                this.adapter.log.info('Turn off: ' + endpointId);
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
        this.adapter.log.info('handleReportState: ' + JSON.stringify(event));
        return new Promise((resolve, reject) => {
            let endpointId = event.event.header.endpoint.endpointId;
            reject('Currently unsupported handleReportState')
        });
    }

}

module.exports = AlexaHandles;
