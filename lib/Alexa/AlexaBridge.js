const AlexaHandles = require('./AlexaHandles');
const AlexaHttpEndpoint = require('./AlexaHttpEndpoint');
const AlexaValidator = require('./AlexaValidator');

class AlexaBridge {

    constructor(adapter, adapterUtils) {
        this.adapter = adapter;
        this.alexaHandles = new AlexaHandles(this.adapter, adapterUtils);
        this.endpoint = new AlexaHttpEndpoint(this.adapter, this);
        this.validator = new AlexaValidator(this.adapter);
    }

    handle(request) {
        const response = this.alexaHandles.handle(request);
        this.validator.validate(response);
        return response;
    }

    unload() {
        this.endpoint && this.endpoint.unload();
    }

}

module.exports = AlexaBridge;
