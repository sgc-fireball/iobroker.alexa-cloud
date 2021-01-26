const BaseDevice = require('./BaseDevice');
const AlexaUtils = require('../Alexa/AlexaUtils');
const AlexaCapabilities = require('../Alexa/AlexaCapabilities');

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

        this.events = false; // object.native.events && object.native.subscribeEvents;
        this.resolution = {width: 2560, height: 1920};
        this.authorizationType = "BASIC"; // BASIC, DIGEST, NONE
        this.videoCodec = "H264"; // H264, MPEG2, MJPEG, JPG
        this.audioCodec = "AAC"; // G711, AAC, NONE
    }

    getStreamUrl()
    {
        return 'rtsp://'+encodeURIComponent(this.username)+':'+encodeURIComponent(this.password)+'@'+this.ip+':'+this.port+'/h264Preview_01_main';
    }

    getSnapshotUrl()
    {
        return 'http://'+this.ip+':80/cgi-bin/api.cgi?cmd=Snap&channel=0&user='+encodeURIComponent(this.username)+'&password='+encodeURIComponent(this.password);
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
                    resolutions: [{width: this.resolution.width, height: this.resolution.height}],
                    authorizationTypes: [this.authorizationType],
                    videoCodecs: [this.videoCodec],
                    audioCodecs: [this.audioCodec],
                }
            ]
        });
        AlexaCapabilities.endpointHealth(device);
        return device;
    }

}

module.exports = ONVIF;
