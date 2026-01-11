const AlexaUtils = require('./AlexaUtils');
const jwt = require('jsonwebtoken');
const uuid = require('uuid').v4;
const moment = require('moment-timezone');

class AlexaHandles {

    constructor(adapter, adapterUtils) {
        this.adapter = adapter;
        this.adapterUtils = adapterUtils;
        this.rtcSessions = [];
    }

    handle(req) {
        this.adapter.log.info('Request: ' + JSON.stringify(req.body));
        let promise = !!req.body.directive ? this.handleRequest(req) : this.handleEvent(req);
        return promise
            .then((response) => {
                this.adapter.log.info('Response: ' + JSON.stringify(response));
                return response;
            })
            .catch((e) => {
                this.adapter.log.warn('Error: ' + e.toString());
            })
    }

    handleRequest(req) {
        let method, namespace = (((req.body || {}).directive || {}).header || {}).namespace || 'Alexa.Unknown';
        if (namespace === 'Alexa') {
            method = 'handle' + (((req.body || {}).directive || {}).header || {}).name || 'Unknown';
        } else {
            method = 'handle' + namespace.replace('Alexa.', '').replace(/\\./g, '');
            method += (((req.body || {}).directive || {}).header || {}).name || 'Unknown';
        }
        if (typeof (this[method]) === "function") {
            return this[method](req);
        }

        return Promise.reject('Unknown request: ' + method);
    }

    handleEvent(req) {
        let name = ((req.body || {}).header || {}).name || 'Unknown';
        let method = 'handle' + name;
        if (typeof (this[method]) === "function") {
            return this[method](req);
        }

        return Promise.reject('Unknown event: ' + method);
    }

    handleAuthorization(req) {
        return new Promise((resolve) => {
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
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['TurnOn', 'TurnOff'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            if (req.body.directive.header.name === 'TurnOn') {
                this.adapter.log.info('Turn on: ' + endpointId);
                await device.power(true);
            } else if (req.body.directive.header.name === 'TurnOff') {
                this.adapter.log.info('Turn off: ' + endpointId);
                await device.power(false);
            }

            let response = AlexaUtils.event(
                { correlationToken: req.body.directive.header.correlationToken },
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
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['SetPercentage', 'AdjustPercentage'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            let percentage = await device.percentage();
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
                { correlationToken: req.body.directive.header.correlationToken },
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
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['SetRangeValue', 'AdjustRangeValue'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
                return;
            }

            let range = await device.range();
            range = Math.max(0, Math.min(range, 100));
            if (req.body.directive.header.name === 'SetRangeValue') {
                range = parseInt(req.body.directive.payload.rangeValue);
            } else if (req.body.directive.header.name === 'AdjustRangeValue') {
                range += parseInt(req.body.directive.payload.rangeValueDelta);
            }
            range = Math.max(0, Math.min(range, 100));
            this.adapter.log.info('Level ' + endpointId + ': ' + range.toString());
            await device.range(range);

            let response = AlexaUtils.event(
                { correlationToken: req.body.directive.header.correlationToken },
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
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            if (['Hold', 'Resume'].indexOf(req.body.directive.header.name) === -1) {
                this.adapter.warn('Unknown action: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
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
                { correlationToken: req.body.directive.header.correlationToken },
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

    handleReportState(req) {
        return new Promise((resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            const cookie = req.body.directive.endpoint.cookie;
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
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
                                correlationToken: req.body.directive.header.correlationToken
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
                        { endpoint: { endpointId: endpointId } },
                        'INTERNAL_ERROR',
                        !!e ? e.toString() : 'Unknown Error on getAlexaContext'
                    ));
                });
        });
    }

    handleThermostatController(req) {
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
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
                        { endpoint: { endpointId: endpointId } },
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

    /**
     * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-camerastreamcontroller.html
     */
    handleCameraStreamController(req) {
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            const config = await device.getConfig();
            const stream = device.getId().split('.').pop();
            const snapshotUrl = this.adapter.config.endpoint
                + '/iobroker/alexa-cloud/snapshots/'
                + stream
                + '?token='
                + req.body.directive.endpoint.scope.token;
            const streamUrl = this.adapter.config.endpoint
                + '/iobroker/alexa-cloud/streams/'
                + stream
                + '?token='
                + req.body.directive.endpoint.scope.token;

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
                                uri: streamUrl,
                                expirationTime: moment().add(1, 'hour').utc(),
                                idleTimeoutSeconds: 30,
                                protocol: config.protocol,
                                resolution: {
                                    width: config.width,
                                    height: config.height
                                },
                                authorizationType: config.authorizationType,
                                videoCodec: config.videoCodec,
                                audioCodec: config.audioCodec
                            }
                        ],
                        imageUri: snapshotUrl
                    }
                }
            );
            response.context = await device.getAlexaContext();
            resolve(response);
        });
    }

    handleBrightnessController(req) {
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                return resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
            }

            if (req.body.directive.header.name === 'SetBrightness') {
                await device.brightness(req.body.directive.payload.brightness);
            } else {
                this.adapter.warn('Unknown action: ' + endpointId);
                return resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
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

    handleColorController(req) {
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                return resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
            }

            if (req.body.directive.header.name === 'SetColor') {
                await device.color(req.body.directive.payload.color);
            } else {
                this.adapter.warn('Unknown action: ' + endpointId);
                return resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
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

    handleColorTemperatureController(req) {
        return new Promise(async (resolve) => {
            const endpointId = req.body.directive.endpoint.endpointId;
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                return resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
            }

            if (req.body.directive.header.name === 'SetColorTemperature') {
                await device.colorTemperature(req.body.directive.payload.colorTemperatureInKelvin);
            } else {
                this.adapter.warn('Unknown action: ' + endpointId);
                return resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INVALID_VALUE',
                    'Unknown action: ' + endpointId + '/' + req.body.directive.header.name
                ));
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

    handleRTCSessionControllerInitiateSessionWithOffer(req) {
        return new Promise(async (resolve) => {
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    {},
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }
            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            const offerFormat = req.body.directive.payload.offer.format;
            if (offerFormat !== 'SDP') {
                this.adapter.log.info('Unknown offer format: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'INTERNAL_ERROR',
                    'Unknown device: ' + endpointId
                ));
                return;
            }
            const sessionId = req.body.directive.payload.sessionId;
            const offerValue = req.body.directive.payload.offer.value;

            if (!this.rtcSessions.indexOf(sessionId)) {
                this.rtcSessions.push(sessionId);
            }

            /**
             * @var device {ONVIF}
             */
            let response = AlexaUtils.event(
                {
                    namespace: 'Alexa.RTCSessionController',
                    name: 'AnswerGeneratedForSession',
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
                        answer: {
                            format: 'SDP',
                            value: ''
                        }
                    }
                }
            );
            response.context = await device.getAlexaContext();
            resolve(response);
        });
    }

    handleRTCSessionControllerSessionConnected(req) {
        return new Promise(async (resolve) => {
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    {},
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            const sessionId = req.body.directive.payload.sessionId;
            if (!this.rtcSessions.indexOf(sessionId)) {
                resolve(AlexaUtils.eventError(
                    {},
                    {},
                    'INTERNAL_ERROR',
                    'Invalid Session.'
                ));
                return;
            }

            /**
             * @var device {ONVIF}
             */
            let response = AlexaUtils.event(
                {
                    namespace: 'Alexa.RTCSessionController',
                    name: 'SessionConnected',
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
                        sessionId
                    }
                }
            );
            resolve(response);
        });
    }

    handleRTCSessionControllerSessionDisconnected(req) {
        return new Promise(async (resolve) => {
            try {
                jwt.verify(req.body.directive.endpoint.scope.token, this.adapter.config.oauth_client_secret);
            } catch (e) {
                resolve(AlexaUtils.eventError(
                    {},
                    {},
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    !!e ? e.toString() : 'Please re-login.'
                ));
                return;
            }

            const endpointId = req.body.directive.endpoint.endpointId;
            const device = this.adapter.getSupportedDevices(endpointId);
            if (device === null) {
                this.adapter.log.info('Unknown device: ' + endpointId);
                resolve(AlexaUtils.eventError(
                    {},
                    { endpoint: { endpointId: endpointId } },
                    'NO_SUCH_ENDPOINT',
                    'Unknown device: ' + endpointId
                ));
                return;
            }

            const sessionId = req.body.directive.payload.sessionId;
            if (!this.rtcSessions.indexOf(sessionId)) {
                resolve(AlexaUtils.eventError(
                    {},
                    {},
                    'INTERNAL_ERROR',
                    'Invalid Session.'
                ));
                return;
            }

            this.rtcSessions = this.rtcSessions.filter(id => id !== sessionId);

            /**
             * @var device {ONVIF}
             */
            let response = AlexaUtils.event(
                {
                    namespace: 'Alexa.RTCSessionController',
                    name: 'SessionDisconnected',
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
                        sessionId
                    }
                }
            );
            resolve(response);
        });
    }
}

module.exports = AlexaHandles;
