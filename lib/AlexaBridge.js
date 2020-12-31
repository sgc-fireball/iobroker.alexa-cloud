const AlexaHandles = require('./AlexaHandles');

class AlexaBridge {

    constructor(adapter) {
        this.adapter = adapter;
        this.alexaHandles = new AlexaHandles(this.adapter);
    }

    handle(request) {
        this.log.info('request: ' + JSON.stringify(request));
        this.alexaHandles.handle(request)
            .then((response) => {
                this.log.info('response: ' + JSON.stringify(response));
            })
            .catch((e) => {
                this.log.warn('error: ' + e);
            });
    }

}
