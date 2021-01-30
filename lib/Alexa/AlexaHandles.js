const AlexaUtils = require('./AlexaUtils');
const jwt = require('jsonwebtoken');
const uuid = require('uuid').v4;
const moment = require('moment-timezone');

class AlexaHandles {

    constructor(adapter, adapterUtils) {
        this.adapter = adapter;
        this.adapterUtils = adapterUtils;
    }

    handle(req) {
        this.adapter.log.info('Request: ' + JSON.stringify(req.body));
        let promise = !!req.body.directive ? this.handleRequest(req) : this.handleEvent(req);
        return promise
            .then((response) => {
                this.adapter.log.info('Response: ' + JSON.stringify(response));
                return response;
            });
    }

    handleRequest(req) {
        let method, namespace = (((req.body || {}).directive || {}).header || {}).namespace || 'Alexa.Unknown';
        if (namespace === 'Alexa') {
            method = 'handle' + (((req.body || {}).directive || {}).header || {}).name || 'Unknown';
        } else {
            method = 'handle' + namespace.replace('Alexa.', '').replace(/\\./g, '');
        }
        if (typeof (this[method]) === "function") {
            return this[method](req);
        }
        return this.handleUnknown(req);
    }

    handleEvent(event, req) {
        let name = ((req.body || {}).header || {}).name || 'Unknown';
        let method = 'handle' + name;
        if (typeof (this[method]) === "function") {
            return this[method](req);
        }
        return this.handleUnknown(req);
    }

    handleUnknown(req) {
        return Promise.reject('handleUnknown: Unknown handle: ' + JSON.stringify(req.body));
    }

    handleAuthorization(req) {
        return new Promise((resolve, reject) => {
            if (req.body.directive.header.name !== 'AcceptGrant') {
                return resolve(AlexaUtils.authorizationDenied('Invalid name.'));
            }
            if (req.body.directive.payload.grantee.type !== 'BearerToken') {
                return resolve(AlexaUtils.authorizationDenied('Invalid grantee type.'));
            }

            try {
                jwt.verify(req.body.directive.payload.grantee.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                return resolve(AlexaUtils.authorizationDenied('Invalid grantee token.'));
            }

            const grant_code = req.body.directive.payload.grant.code;
            this.adapter.log.info('Try to get amazon access_token with code: ' + grant_code);
            this.adapterUtils.postForm(
                'https://api.amazon.com/auth/o2/token',
                {
                    grant_type: 'authorization_code',
                    code: grant_code,
                    client_id: this.adapter.config.alexa_client_id,
                    client_secret: this.adapter.config.alexa_client_secret
                }
            )
                .then(body => {
                    this.adapter.log.info('Received access_token: ' + body);
                    const json = JSON.parse(body);
                    this.adapter.log.info('Store access_token.');

                    this.adapter.setState('info.token_type', json.token_type, true);
                    this.adapter.setState('info.access_token', json.access_token, true);
                    this.adapter.setState('info.refresh_token', json.refresh_token, true);
                    this.adapter.setState('info.expires_at', Math.floor(Date.now() + ((json.expires_in - 60) * 1000)).toString(), true);

                    this.adapter.log.info('Set adapter to connected state.');
                    this.adapter.setState('info.connection', true, true);
                    /**
                     * @see https://developer.amazon.com/en-US/docs/alexa/account-linking/skill-activation-api.html#get-status
                     * HOST https://api.eu.amazonalexa.com
                     * Authorization: Bearer <access_token>
                     */
                    this.adapter.log.info('handleAuthorization accepted');
                    return resolve(AlexaUtils.authorizationAccepted());
                })
                .catch((e) => {
                    this.adapter.log.warn('handleAuthorization: ' + JSON.stringify(e));
                    return resolve(AlexaUtils.authorizationDenied(!!e ? e.toString() : 'Could not get amazon access_token.'));
                })
        });
    }

    handleDiscovery(req) {
        return new Promise(async (resolve) => {
            try {
                jwt.verify(req.body.directive.payload.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError({}, {}, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Please relogin.'));
                return;
            }

            let endpoints = [];
            let devices = Object.values(this.adapter.getSupportedDevices());
            for (let i = 0; i < devices.length; i++) {
                const device = devices[i];
                try {
                    let endpoint = await device.getAlexaDiscovery();
                    if (!!endpoint) {
                        this.adapter.log.info('Alexa Discovery: ' + device.getId() + ': ' + endpoint.friendlyName + ' (' + endpoint.manufacturerName + ')');
                        endpoints.push(endpoint);
                    }
                } catch (e) {
                    if (!!e && !!e.toString() && e.toString() !== 'Error: null') {
                        this.adapter.log.warn('Alexa Discovery: ' + device.getId() + ': ' + e.toString());
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
    handlePowerController(req) {
        return new Promise(async (resolve, reject) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['TurnOn', 'TurnOff'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            if (req.body.directive.header.name === 'TurnOn') {
                this.adapter.log.info('Turn on: ' + endpointId);
                await device.on();
            } else if (req.body.directive.header.name === 'TurnOff') {
                this.adapter.log.info('Turn off: ' + endpointId);
                await device.off();
            }

            let response = AlexaUtils.event(
                {correlationToken: req.body.directive.header.correlationToken},
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: req.body.directive.endpoint.scope.token
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
    handlePercentageController(req) {
        return new Promise(async (resolve, reject) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['SetPercentage', 'AdjustPercentage'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            let percentage = await device.level();
            percentage = Math.max(0, Math.min(percentage, 100));
            if (req.body.directive.header.name === 'SetPercentage') {
                percentage = parseInt(req.body.directive.payload.percentage);
            } else if (req.body.directive.header.name === 'AdjustPercentage') {
                percentage += parseInt(req.body.directive.payload.percentageDelta);
                this.adapter.log.info('Level ' + endpointId + ': ' + percentage.toString());
            }
            percentage = Math.max(0, Math.min(percentage, 100));
            await device.percentage(percentage);

            let response = AlexaUtils.event(
                {correlationToken: req.body.directive.header.correlationToken},
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: req.body.directive.endpoint.scope.token
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
    handleRangeController(req) {
        return new Promise(async (resolve, reject) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['SetRangeValue', 'AdjustRangeValue'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            let percentage = await device.level();
            percentage = Math.max(0, Math.min(percentage, 100));
            if (req.body.directive.header.name === 'SetRangeValue') {
                percentage = parseInt(req.body.directive.payload.rangeValue);
            } else if (req.body.directive.header.name === 'AdjustRangeValue') {
                percentage += parseInt(req.body.directive.payload.rangeValueDelta);
            }
            percentage = Math.max(0, Math.min(percentage, 100));
            this.adapter.log.info('Level ' + endpointId + ': ' + percentage.toString());
            await device.percentage(percentage);

            let response = AlexaUtils.event(
                {correlationToken: req.body.directive.header.correlationToken},
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: req.body.directive.endpoint.scope.token
                        },
                    },
                    payload: {}
                }
            );
            response.context = await device.getAlexaContext();
            resolve(response);
        });
    }

    handleTimeHoldController(req) {
        return new Promise(async (resolve, reject) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['Hold', 'Resume'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            if (req.body.directive.header.name === 'Hold') {
                this.adapter.log.info('Hold: ' + endpointId);
                await device.hold();
            } else if (req.body.directive.header.name === 'Resume') {
                this.adapter.log.info('Resume: ' + endpointId);
                await device.resume();
            }

            let response = AlexaUtils.event(
                {correlationToken: req.body.directive.header.correlationToken},
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: req.body.directive.endpoint.scope.token
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
                jwt.verify(event.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device.'
                ));
                return;
            }
            device.getAlexaContext()
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

    handleThermostatController(req) {
        return new Promise(async (resolve, reject) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            let target = await device.getTargetTemperature();

            switch (req.body.directive.header.name) {
                case 'SetTargetTemperature':
                    target = parseFloat(req.body.directive.payload.targetSetpoint.value);
                    target = Math.max(7, Math.min(target, 30));
                    this.adapter.log.info('SET TEMP: ' + target.toString());
                    device.setTemperature(target);
                    break;
                case 'AdjustTargetTemperature':
                    target += parseFloat(req.body.directive.payload.targetSetpointDelta.value);
                    target = Math.max(7, Math.min(target, 30));
                    this.adapter.log.info('SET TEMP: ' + target.toString());
                    device.setTemperature(target);
                    break;
                case 'SetThermostatMode':
                    req.body.directive.payload.thermostatMode.value;
                    break;
                default:
                    this.adapter.warn('Unknown action: ' + endpointId);
                    resolve(AlexaUtils.eventError(
                        {},
                        {endpoint: {endpointId: endpointId}},
                        'INVALID_VALUE',
                        'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                    ));
                    return;
            }

            let response = AlexaUtils.event(
                {
                    correlationToken: req.body.directive.header.correlationToken
                },
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: req.body.directive.endpoint.scope.token
                        },
                    },
                    payload: {}
                }
            );
            response.context = await device.getAlexaContext();
            resolve(response);
        });
    }

    handleCameraStreamController(req) {
        return new Promise(async (resolve, reject) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    {endpoint: {endpointId: endpointId}},
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            const httpHost = req.protocol + '://' + req.hostname;
            const cameraStreams = req.body.directive.payload.cameraStreams;
            const stream = cameraStreams[0];

            /**
             * @var device {ONVIF}
             */
            let response = AlexaUtils.event(
                {
                    namespace: 'Alexa.CameraStreamController',
                    correlationToken: req.body.directive.header.correlationToken
                },
                {
                    endpoint: {
                        endpointId: endpointId,
                        scope: {
                            type: "BearerToken",
                            token: req.body.directive.endpoint.scope.token
                        },
                    },
                    payload: {
                        cameraStreams: [
                            {
                                uri: httpHost + device.getHighStreamUrl(stream),
                                expirationTime: moment().add(1, 'day').utc(),
                                idleTimeoutSeconds: 30,
                                protocol: stream.protocol,
                                resolution: {
                                    width: stream.width,
                                    height: stream.height
                                },
                                authorizationType: stream.authorizationType,
                                videoCodec: stream.videoCodec,
                                audioCodec: stream.audioCodec
                            }
                        ],
                        imageUri: httpHost + device.getSnapshotUrl(stream)
                    }
                }
            );
            response.context = await device.getAlexaContext();
            resolve(response);
        });
    }

}

module.exports = AlexaHandles;
