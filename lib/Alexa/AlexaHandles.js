const AlexaUtils = require('./AlexaUtils');
const jwt = require('jsonwebtoken');
const uuid = require('uuid').v4;

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
        let method, namespace = (((request || {}).directive || {}).header || {}).namespace || 'Alexa.Unknown';
        if (namespace === 'Alexa') {
            method = 'handle' + (((request || {}).directive || {}).header || {}).name || 'Unknown';
        } else {
            method = 'handle' + namespace.replace('Alexa.', '').replace(/\\./g, '');
        }
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
            //const grant_code = request.directive.payload.grant.code;
            jwt.verify(request.directive.payload.grantee.token, this.adapter.config.oauth_secret);
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
                        this.adapter.log.info('Alexa Discovery: ' + endpoint.friendlyName + ' (' + endpoint.manufacturerName + ')');
                        endpoints.push(endpoint);
                    }
                } catch (e) {
                    if (!!e && !!e.toString() && e.toString() !== 'Error: null') {
                        this.adapter.log.warn('Alexa Discovery: ' + e.toString());
                    }
                }
            }
            let count = endpoints.length;
            this.adapter.log.info('Alexa: Discovery: test ' + devices.length + ' devices. ' + count + ' are alexa compatible.');
            if (count > 300) {
                this.adapter.log.warn('Alexa Discovery: Found ' + count + ' devices. Slice to 300 endpoints. Rerun discover.');
                endpoints = this.adapterUtils.shuffle(endpoints);
                endpoints = endpoints.slice(0, Math.min(300, count));
            }
            resolve(AlexaUtils.discoverResponse(endpoints));
        });
    }

    /**
     * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-powercontroller.html
     */
    handlePowerController(request) {
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['TurnOn', 'TurnOff'].indexOf(request.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
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
                {correlationToken: request.directive.header.correlationToken},
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

    /**
     * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-percentagecontroller.html
     */
    handlePercentageController(request) {
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['SetPercentage', 'AdjustPercentage'].indexOf(request.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + request.directive.header.name
                ));
                return;
            }

            const device = devices[endpointId];
            let percentage = await device.level();
            percentage = Math.max(0, Math.min(percentage, 100));
            if (request.directive.header.name === 'SetPercentage') {
                percentage = parseInt(request.directive.payload.percentage);
            } else if (request.directive.header.name === 'AdjustPercentage') {
                percentage += parseInt(request.directive.payload.percentageDelta);
                this.adapter.log.info('Level ' + endpointId + ': ' + percentage.toString());
            }
            percentage = Math.max(0, Math.min(percentage, 100));
            await device.percentage(percentage);

            let response = AlexaUtils.event(
                {correlationToken: request.directive.header.correlationToken},
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

    /**
     * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-rangecontroller.html#setrangevalue-directive
     */
    handleRangeController(request) {
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['SetRangeValue', 'AdjustRangeValue'].indexOf(request.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + request.directive.header.name
                ));
                return;
            }

            const device = devices[endpointId];
            let percentage = await device.level();
            percentage = Math.max(0, Math.min(percentage, 100));
            if (request.directive.header.name === 'SetRangeValue') {
                percentage = parseInt(request.directive.payload.rangeValue);
            } else if (request.directive.header.name === 'AdjustRangeValue') {
                percentage += parseInt(request.directive.payload.rangeValueDelta);
            }
            percentage = Math.max(0, Math.min(percentage, 100));
            this.adapter.log.info('Level ' + endpointId + ': ' + percentage.toString());
            await device.percentage(percentage);

            let response = AlexaUtils.event(
                {correlationToken: request.directive.header.correlationToken},
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

    handleTimeHoldController(request) {
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['Hold', 'Resume'].indexOf(request.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + request.directive.header.name
                ));
                return;
            }

            const device = devices[endpointId];
            if (request.directive.header.name === 'Hold') {
                this.adapter.log.info('Hold: ' + endpointId);
                await device.hold();
            } else if (request.directive.header.name === 'Resume') {
                this.adapter.log.info('Resume: ' + endpointId);
                await device.resume();
            }

            let response = AlexaUtils.event(
                {correlationToken: request.directive.header.correlationToken},
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
        return new Promise((resolve, reject) => {
            const endpointId = event.directive.endpoint.endpointId;
            const cookie = event.directive.endpoint.cookie;
            try {
                jwt.verify(event.directive.endpoint.scope.token, this.adapter.config.oauth_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device.'
                ));
                return;
            }
            devices[endpointId].getAlexaContext()
                .then((context) => {
                    resolve({
                        event: {
                            header: {
                                namespace: "Alexa",
                                name: "StateReport",
                                payloadVersion: 3,
                                messageId: uuid(),
                                correlationToken: event.directive.header.correlationToken
                            },
                            endpoint: {
                                endpointId: endpointId
                            },
                            payload: {},
                        },
                        context: context
                    });
                })
                .catch((e) => {
                    this.adapter.log.warn('ERROR: ' + (!!e ? e.toString() : 'Unknown Error on getAlexaContext'));
                    resolve(AlexaUtils.eventError(
                        {},
                        {endpoint: {endpointId: endpointId}},
                        'INTERNAL_ERROR',
                        !!e ? e.toString() : 'Unknown Error on getAlexaContext'
                    ));
                });
        });
    }

    handleThermostatController(request) {
        return new Promise(async (resolve, reject) => {
            const endpointId = request.directive.endpoint.endpointId;
            const devices = this.adapter.getSupportedDevices();
            if (!devices.hasOwnProperty(endpointId)) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            const device = devices[endpointId];
            let target = await device.getTargetTemperature();

            switch (request.directive.header.name) {
                case 'SetTargetTemperature':
                    target = parseFloat(request.directive.payload.targetSetpoint.value);
                    target = Math.max(7, Math.min(target, 30));
                    this.adapter.log.info('SET TEMP: ' + target.toString());
                    device.setTemperature(target);
                    break;
                case 'AdjustTargetTemperature':
                    target += parseFloat(request.directive.payload.targetSetpointDelta.value);
                    target = Math.max(7, Math.min(target, 30));
                    this.adapter.log.info('SET TEMP: ' + target.toString());
                    device.setTemperature(target);
                    break;
                case 'SetThermostatMode':
                    request.directive.payload.thermostatMode.value;
                default:
                    this.adapter.warn('Unknown action: ' + endpointId);
                    resolve(AlexaUtils.eventError(
                        {},
                        {endpoint: {endpointId: endpointId}},
                        'INVALID_VALUE',
                        'Unknown action: ' + endpointId + '/' + request.directive.header.name
                    ));
                    return;
            }

            let response = AlexaUtils.event(
                {correlationToken: request.directive.header.correlationToken},
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

}

module.exports = AlexaHandles;
