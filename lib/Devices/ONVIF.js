const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');
const moment = require('moment-timezone');

/**
 * IP Camera
 * @link https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-camerastreamcontroller.html
 */
class ONVIF extends BaseDevice {

    constructor(adapter, object) {
        super(adapter, object);
    }

    async getConfig() {
        return {
            name: await this.getState(this.getId() + '.name', 'Camera'),
            protocol: await this.getState(this.getId() + '.protocol', 'RTSP'), // RTSP, HLS
            username: await this.getState(this.getId() + '.username', 'admin'),
            password: await this.getState(this.getId() + '.password', 'admin'),
            host: await this.getState(this.getId() + '.host', '127.0.0.1'),
            port: await this.getState(this.getId() + '.port', 443),
            authorizationType: await this.getState(this.getId() + '.authorizationType', 'BASIC'), // BASIC, DIGEST, NONE
            videoCodec: await this.getState(this.getId() + '.videoCodec', 'H264'), // H264, MPEG2, MJPEG, JPG
            audioCodec: await this.getState(this.getId() + '.audioCodec', 'AAC'), // G711, AAC, NONE
            width: await this.getState(this.getId() + '.width', 640),
            height: await this.getState(this.getId() + '.height', 480),
            path: await this.getState(this.getId() + '.path', '/'),
        }
    }

    async getAlexaDiscovery() {
        const config = await this.getConfig();
        let device = AlexaUtils.buildDevice({
            endpointId: this.endpointId,
            manufacturer: 'ioBroker - ONVIF',
            model: 'IPC',
            friendlyName: config.name,
            description: 'ioBroker - ONVIF - ' + config.host + ':' + config.port,
            displayCategories: ['CAMERA']
        });
        AlexaCapabilities.default(device);
        AlexaCapabilities.endpointHealth(device);
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.CameraStreamController",
            version: "3",
            cameraStreamConfigurations: [
                {
                    protocols: [config.protocol],
                    resolutions: [{ width: config.width, height: config.height }],
                    authorizationTypes: [config.authorizationType],
                    videoCodecs: [config.videoCodec],
                    audioCodecs: [config.audioCodec],
                },
            ]
        });
        return device;
    }

    async getAlexaContext() {
        let utc = moment().utc();
        const context = { properties: [] };
        context.properties.push({
            namespace: "Alexa.EndpointHealth",
            name: "connectivity",
            value: {
                value: 'OK',
            },
            timeOfSample: utc.format(),
            uncertaintyInMilliseconds: 0
        });
        return context;
    }

    async getSnapshotUrl() {
        const config = await this.getConfig();
        return 'https://placehold.co/' + config.width + 'x' + config.height + '/000000/FFFFFF/png?text=' + encodeURIComponent(config.name);
    }

    async getStreamUrl() {
        const config = await this.getConfig();
        let uri = '';
        uri += (config?.protocol === 'RTSP') ? 'rtsps://' : 'https://';
        if (config.authorizationType !== 'NONE') {
            uri += encodeURIComponent(config.username) + ':';
            uri += encodeURIComponent(config.password) + '@';
        }
        uri += config.host + ':' + config.port;
        uri += config.path.startsWith('/') ? config.path : '/' + config.path;
        return uri;
    }

}

module.exports = ONVIF;
