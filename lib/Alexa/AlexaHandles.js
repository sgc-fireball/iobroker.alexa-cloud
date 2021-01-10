const AlexaUtils = require('./AlexaUtils');
const jwt = require('jsonwebtoken');

class AlexaHandles {

    constructor(adapter, adapterUtils) {
        this.adapter = adapter;
        this.adapterUtils = adapterUtils;
    }

    handle(request) {
        this.adapter.log.info('Request: ' + JSON.stringify(request));
        let promise = !!request.directive ? this.handleRequest(request) : this.handleEvent(request);
        return promise
            .then((response) => {
                this.adapter.log.info('Response: ' + JSON.stringify(response));
                return response;
            });
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
        if (request.directive.header.name !== 'AcceptGrant') {
            return Promise.resolve(AlexaUtils.authorizationDenied('Invalid name.'));
        }
        if (request.directive.payload.grantee.type !== 'BearerToken') {
            return Promise.resolve(AlexaUtils.authorizationDenied('Invalid grantee type.'));
        }
        try {
            const grant_code = request.directive.payload.grant.code;
            const grantee_token = request.directive.payload.grantee.token;
            const token = jwt.verify(grantee_token, this.adapter.config.oauth_secret);
        } catch (e) {
            return Promise.resolve(AlexaUtils.authorizationDenied('Invalid token.'));
        }
        return Promise.resolve(AlexaUtils.authorizationAccepted());
    }

    handleDiscovery(request) {
        return new Promise(async (resolve) => {
            try {
                jwt.verify(request.directive.payload.scope.token, this.adapter.config.oauth_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError({}, {}, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Please relogin.'));
                return;
            }

            let endpoints = [];
            let devices = Object.values(this.adapter.getSupportedDevices());
            for (let i = 0; i < devices.length; i++) {
                try {
                    let endpoint = await devices[i].getAlexaDiscovery();
                    if (!!endpoint) {
                        endpoints.push(endpoint);
                    }
                } catch (e) {
                }
            }
            let count = endpoints.length;
            if (count > 300) {
                this.adapter.log.warn('Found ' + count + ' devices. Slice to 300 endpoints. Rerun discover.');
                endpoints = this.adapterUtils.shuffle(endpoints);
                endpoints = endpoints.slice(0, Math.min(300, count));
            }
            resolve(AlexaUtils.discoverResponse(endpoints));
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
