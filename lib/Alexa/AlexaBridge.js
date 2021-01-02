const AlexaHandles = require('./AlexaHandles');
const AlexaHttpEndpoint = require('./AlexaHttpEndpoint');

class AlexaBridge {

    constructor(adapter) {
        this.reports = {};
        this.adapter = adapter;
        this.alexaHandles = new AlexaHandles(this.adapter);
        this.endpoint = new AlexaHttpEndpoint(this.adapter);
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
        if (!this.reports.hasOwnProperty(device.id)) {
            this.reports[device.id] = setTimeout(() => {
                delete this.reports[device.id];

                const context = device.getAlexaContext();
                if (context) {
                    context.then((context) => {
                        this.adapter.log.info('REPORT: ' + JSON.stringify(context));
                    }).catch((e) => {
                        this.adapter.log.warn('ERROR: ' + e);
                    });
                }
            }, 60 * 1000);
        }
    }

    unload() {
        this.endpoint && this.endpoint.unload();
    }

}

module.exports = AlexaBridge;
