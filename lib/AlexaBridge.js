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
                this.adapter.log.info('response: ' + JSON.stringify(response));
            })
            .catch((e) => {
                this.adapter.log.warn('AlexaBridge.handle: ' + e);
            });
    }

    report(device) {
        const context = device.getAlexaContext();
        this.adapter.log.info('INFO: ' + JSON.stringify(context));
        if (context) {
            context
                .then((context) => {
                    this.adapter.log.info('INFO: ' + JSON.stringify(context));
                })
                .catch((e) => {
                    this.adapter.log.warn('AlexaBridge.report: ' + e);
                });
        }
    }

}

module.exports = AlexaBridge;
