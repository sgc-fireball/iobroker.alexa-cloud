const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');
const moment = require('moment-timezone');

// IP Camera

class ONVIF extends BaseDevice {

    constructor(adapter, object) {
        super(adapter, object);
        this.name = ((object || {}).common || {}).name || 'Kamera';

        this.protocol = "RTSP"; // [this.protocol], // allowed RTSP, HLS
        this.username = ((object || {}).native || {}).user || 'demo';
        this.password = ((object || {}).native || {}).password || '123456';
        this.ip = '192.168.2.203'; // object.native.ip;
        this.port = 554; // object.native.port;

        this.authorizationType = "BASIC"; // BASIC, DIGEST, NONE
        this.videoCodec = "H264"; // H264, MPEG2, MJPEG, JPG
        this.audioCodec = "AAC"; // G711, AAC, NONE
    }

    getHighStreamUrl(stream) {
        stream = {
            'authorizationType': 'BASIC',
            'protocol': 'RTSP',
            'videoCodec': 'H264',
            'audioCodec': 'AAC',
            'resolution': {
                'width': 2560,
                'height': 1920
            }
        };
        return '/iobroker/alexa-cloud/streams/' + this.getEndpointId();
        //this.adapter.log.info('getHighStreamUrl(' + width + ', ' + height + ')');
        // @TODO need to proxy by port 443
        // @TODO https://github.com/k-yle/rtsp-relay
        /*if (width > 1920) {
            return 'rtsp://' + encodeURIComponent(this.username) + ':' + encodeURIComponent(this.password) + '@' + this.ip + ':' + this.port + '/h264Preview_01_main';
        }
        return 'rtsp://' + encodeURIComponent(this.username) + ':' + encodeURIComponent(this.password) + '@' + this.ip + ':' + this.port + '/h264Preview_01_sub';*/
    }

    getSnapshotUrl(stream) {
        stream = {
            'authorizationType': 'BASIC',
            'protocol': 'RTSP',
            'videoCodec': 'H264',
            'audioCodec': 'AAC',
            'resolution': {
                'width': 2560,
                'height': 1920
            }
        };
        return '/iobroker/alexa-cloud/snapshots/' + this.getEndpointId();
        //return 'https://' + this.ip + ':443/cgi-bin/api.cgi?cmd=Snap&channel=0&user=' + encodeURIComponent(this.username) + '&password=' + encodeURIComponent(this.password);
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
        /**
         * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-camerastreamcontroller.html
         */
        device.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.CameraStreamController",
            version: "3",
            cameraStreamConfigurations: [
                {
                    protocols: [this.protocol],
                    resolutions: [{width: 2560, height: 1920}],
                    authorizationTypes: [this.authorizationType],
                    videoCodecs: [this.videoCodec],
                    audioCodecs: [this.audioCodec],
                },
                {
                    protocols: [this.protocol],
                    resolutions: [{width: 640, height: 480}],
                    authorizationTypes: [this.authorizationType],
                    videoCodecs: [this.videoCodec],
                    audioCodecs: [this.audioCodec],
                },
            ]
        });
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

    async getAlexaContext() {
        let utc = moment().utc();
        const context = {properties: []};
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
