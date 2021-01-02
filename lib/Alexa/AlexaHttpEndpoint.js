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
        this.app.get('/', (req, res, next) => {
            res.status(200).send('Adapter OK!');
        });

        const port = ((this.adapter ?? {}).config || {}).port || 31000;
        this.server = this.app.listen(port, () => {
            this.adapter.log.info(
                'Webserver started: http://'
                + this.server.address().address
                + ':'
                + this.server.address().port
                + '/iobroker/alexa-cloud/endpoint'
            );
        });
    }

    index(req, res, next) {
        res.status(200).send('OK!');
    }

    unload() {
        this.server && this.server.close();
    }

}

module.exports = AlexaHttpEndpoint;
