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
        const config = ((object || {}).native || {});

        this.name = config?.name || 'Camera';
        this.protocol = config?.protocol || "RTSP"; // allowed RTSP, HLS
        this.username = config?.user || config?.username || 'admin';
        this.password = config?.pass || config?.password || 'admin';
        this.ip = config?.ip || '127.0.0.1';
        this.port = config?.port || 443;
        this.authorizationType = config?.authorizationType || "BASIC"; // BASIC, DIGEST, NONE
        this.videoCodec = config?.videoCodec || "H264"; // H264, MPEG2, MJPEG, JPG
        this.audioCodec = config?.audioCodec || "AAC"; // G711, AAC, NONE
        this.width = config?.width || 640;
        this.height = config?.height || 480;
        this.path = config?.path || '/';
    }

    async getAlexaDiscovery() {
        let device = AlexaUtils.buildDevice({
            endpointId: this.endpointId,
            manufacturer: 'ioBroker - ONVIF',
            model: 'IPC',
            friendlyName: this.name,
            description: 'ioBroker - ONVIF - ' + this.ip + ':' + this.port,
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
                    protocols: [this.protocol],
                    resolutions: [{ width: this.width, height: this.height }],
                    authorizationTypes: [this.authorizationType],
                    videoCodecs: [this.videoCodec],
                    audioCodecs: [this.audioCodec],
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

}

module.exports = ONVIF;
