'use strict';

const express = require('express');
const verifier = require('alexa-verifier-middleware');
const bodyParser = require('body-parser');

class AlexaHttpEndpoint {

    constructor(adapter) {
        this.adapter = adapter;

        /*const customSkillRouter = express.Router();
        customSkillRouter.use(verifier);
        customSkillRouter.use(bodyParser.json());
        customSkillRouter.get('/', (req, res, next) => {
            return this.index(req, res, next);
        });*/

        this.app = express();
        this.app.disable('x-powered-by');
        this.app.disable('etag');
        this.app.disable('server');
        //this.app.use('/iobroker/alexa-cloud/endpoint', customSkillRouter);
        this.app.get('/iobroker/alexa-cloud/auth', (req, res, next) => {
            return this.oauthAuth(req, res, next);
        });
        this.app.get('/iobroker/alexa-cloud/token', (req, res, next) => {
            return this.oauthToken(req, res, next);
        });
        this.app.get('/iobroker/alexa-cloud/smarthome', (req, res, next) => {
            return this.smarthome(req, res, next);
        });
        this.app.get('/', (req, res, next) => {
            return this.index(req, res, next);
        });
        this.server = this.app.listen(this.adapter.config.port, () => {
            this.adapter.log.info('Webserver started on port: ' + this.server.address().port);
        });
    }

    index(req, res, next) {
        res.status(200).send('OK!');
    }

    oauthAuth(req, res, next) {
        res.status(200).send('OAuth 2.0 Auth');
    }

    oauthToken(req, res, next) {
        res.status(200).send('OAuth 2.0 Token');
    }

    smarthome(req, res, next) {
        this.adapter.log.info('SmartHome: ' + JSON.stringify(req.body));
        res.status(204).send('');
    }

    unload() {
        this.server && this.server.close();
    }

}

module.exports = AlexaHttpEndpoint;
