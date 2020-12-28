const AlexaUtils = require('./AlexaUtils');
const AlexaCapabilities = require('./AlexaCapabilities');

class AlexaHandles {

    handle(request) {
        let namespace = request.directive.header.namespace;
        let method = 'handle' + namespace.replace('Alexa.', '');
        if (this.hasOwnProperty(method)) {
            return this[method]();
        }
        return Promise.reject('No supported namespace: ' + namespace);
    }

    handleAuthorization(request) {
        return Promise.reject('Currently unsupported handleAuthorization');
    }

    handleDiscovery(request) {
        return Promise.reject('Currently unsupported handleDiscovery');

        return new Promise((resolve, reject) => {
            let userAccessToken = request.directive.payload.scope.token.trim();
            if (!userAccessToken) {
                reject(`Discovery Request [${request.header.messageId}] failed. Invalid access token: ${userAccessToken}`);
            } else {
                let device = AlexaUtils.buildDevice();
                AlexaCapabilities.default(device);
                AlexaCapabilities.temperatureSensor(device);
                let endpoints = [device];
                resolve(AlexaUtils.discoverResponse(endpoints));
            }
        });
    }

    handleCameraStreamController(request) {
        return Promise.reject('Currently unsupported handleCameraStreamController');
    }

}

module.exports = new AlexaHandles();
