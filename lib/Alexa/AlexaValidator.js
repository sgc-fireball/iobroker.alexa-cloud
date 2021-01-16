'use strict';

const AlexaSchema = require('./AlexaSchema.js');
const Ajv = require("ajv");
const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}
const alexaSchemaValidate = ajv.compile(AlexaSchema)

class AlexaValidator {

    constructor(adapter) {
        this.adapter = adapter;
    }

    validate(data) {
        const valid = alexaSchemaValidate(data);
        if (!valid) {
            this.adapter.log.error(
                JSON.stringify(
                    alexaSchemaValidate.errors
                )
            );
        }
        return !!valid;
    }

}

module.exports = AlexaValidator;
