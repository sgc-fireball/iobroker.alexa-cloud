const AlexaHandles = require('./AlexaHandles');
const AlexaHttpEndpoint = require('./AlexaHttpEndpoint');

class AlexaBridge {

    constructor(adapter, adapterUtils) {
        this.adapter = adapter;
        this.alexaHandles = new AlexaHandles(this.adapter, adapterUtils);
        this.endpoint = new AlexaHttpEndpoint(this.adapter, this);
    }

    handle(request) {
        return this.alexaHandles.handle(request);
    }

    unload() {
        this.endpoint && this.endpoint.unload();
    }

}

module.exports = AlexaBridge;
