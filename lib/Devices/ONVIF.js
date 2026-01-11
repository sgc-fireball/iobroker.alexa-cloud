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
        const protocol = await this.getState(this.getId() + '.protocol', 'RTSP'); // RTSP, HLS
        return {
            name: await this.getState(this.getId() + '.name', 'Camera'),
            protocol,
            username: await this.getState(this.getId() + '.username', 'admin'),
            password: await this.getState(this.getId() + '.password', 'admin'),
            authorizationType: await this.getState(this.getId() + '.authorizationType', 'BASIC'), // BASIC, DIGEST, NONE
            videoCodec: await this.getState(this.getId() + '.videoCodec', 'H264'), // H264, MPEG2, MJPEG, JPG
            audioCodec: await this.getState(this.getId() + '.audioCodec', 'AAC'), // G711, AAC, NONE
            width: await this.getState(this.getId() + '.width', 640),
            height: await this.getState(this.getId() + '.height', 480),

            host: await this.getState(this.getId() + '.host', '127.0.0.1'),
            port: await this.getState(this.getId() + '.port', protocol === 'RTSP' ? 554 : 443),
            path: await this.getState(this.getId() + '.path', '/'),

            snapshotUrl: await this.getState(this.getId() + '.snapshotUrl', ''),
            streamUrl: await this.getState(this.getId() + '.streamUrl', ''),
        }
    }

    async getAlexaDiscovery() {
        const config = await this.getConfig();
        let device = AlexaUtils.buildDevice({
            endpointId: this.endpointId,
            manufacturer: 'ioBroker - ONVIF',
            model: 'IPC',
            friendlyName: config.name,
            description: 'ioBroker - ONVIF - ' + config.name,
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
        let snapshotUrl = config.snapshotUrl || '';
        if (!snapshotUrl) {
            return 'https://placehold.co/' + config.width + 'x' + config.height + '/000000/FFFFFF/png?text=' + encodeURIComponent(config.name);
        }

        for (let key of Object.keys(config)) {
            const value = config[key] || '';
            while (snapshotUrl.indexOf('{' + key + '}') !== -1) {
                snapshotUrl = snapshotUrl.replace('{' + key + '}', encodeURIComponent(value));
            }
        }
        snapshotUrl = snapshotUrl.replace('{random}', 1_000_000 + parseInt(Math.random() * 9_000_000));
        return snapshotUrl;
    }

    async getStreamUrl() {
        const config = await this.getConfig();
        let streamUrl = config.streamUrl || '';

        if (streamUrl) {
            for (let key of Object.keys(config)) {
                const value = config[key];
                while (streamUrl.indexOf('{' + key + '}') !== -1) {
                    streamUrl = streamUrl.replace('{' + key + '}', encodeURIComponent(value));
                }
            }
            streamUrl = streamUrl.replace('{random}', 1_000_000 + parseInt(Math.random() * 9_000_000));
            return streamUrl;
        }

        let uri = '';
        uri += (config?.protocol === 'RTSP') ? 'rtsp://' : 'https://';
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
