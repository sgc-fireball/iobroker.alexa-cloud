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
                this.adapter.log.info('Response: ' + JSON.stringify(response));
            })
            .catch((e) => {
                this.adapter.log.warn('AlexaBridge.handle: ' + e);
            });
    }

    report(device) {
        // @TODO limit the reports per device via debounce
        // @see AdapterUtils.debounce
        const context = device.getAlexaContext();
        if (context) {
            context
                .then((context) => {
                    this.adapter.log.info('REPORT: ' + JSON.stringify(context));
                })
                .catch((e) => {
                    // incomplet state values
                    this.adapter.log.warn('ERROR: ' + err);
                });
        }
    }

}

module.exports = AlexaBridge;
