'use strict';

const express = require('express');
const verifier = require('alexa-verifier-middleware');
const bodyParser = require('body-parser');

class AlexaHttpEndpoint {

    constructor(adapter) {
        this.adapter = adapter;

        const alexaRouter = express.Router();
        alexaRouter.use(verifier);
        alexaRouter.use(bodyParser.json());
        alexaRouter.get('/', (req, res, next) => {
            return this.index(req, res, next);
        });

        this.app = express();
        this.app.disable('x-powered-by');
        this.app.disable('etag');
        this.app.disable('server');
        this.app.use('/iobroker/alexa-cloud/endpoint', alexaRouter);
        this.server = this.app.listen(this.adapter.config.port || 31000);
    }

    index(req, res, next) {
        res.status(200).send('OK!');
    }

    unload() {
        this.server && this.server.close();
    }

}

module.exports = AlexaHttpEndpoint;
