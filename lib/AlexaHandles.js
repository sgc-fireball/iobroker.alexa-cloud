const AlexaUtils = require('./AlexaUtils');

class AlexaHandles {

    constructor(adapter) {
        this.adapter = adapter;
    }

    handle(request) {
        let namespace = (((request || {}).directive || {}).header || {}).namespace || 'Alexa.Unknown';
        let method = 'handle' + namespace.replace('Alexa.', '');
        if (this.hasOwnProperty(method)) {
            return this[method]();
        }
        !!this.adapter && this.adapter.log('handle: ' + JSON.stringify(request));
        return Promise.reject('No supported namespace: ' + namespace);
    }

    handleAuthorization(request) {
        !!this.adapter && this.adapter.log('handleAuthorization: ' + JSON.stringify(request));
        return Promise.reject('Currently unsupported handleAuthorization');
    }

    handleDiscovery(request) {
        !!this.adapter && this.adapter.log('handleDiscovery: ' + JSON.stringify(request));
        return new Promise((resolve, reject) => {
            /*let userAccessToken = request.directive.payload.scope.token.trim();
            if (!userAccessToken) {
                reject(`Discovery Request [${request.header.messageId}] failed. Invalid access token: ${userAccessToken}`);
            } else {*/
            let endpoints = [];
            Object.values(this.adapter.getSupportedDevices()).forEach((device) => {
                let endpoint = device.getAlexaDiscovery();
                if (!!endpoint) {
                    endpoints.push(endpoint);
                }
            });
            resolve(AlexaUtils.discoverResponse(endpoints));
            //}
        });
    }

}

module.exports = AlexaHandles;
