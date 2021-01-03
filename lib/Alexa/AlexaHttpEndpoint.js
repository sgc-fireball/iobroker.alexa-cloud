'use strict';

const express = require('express');
//const verifier = require('alexa-verifier-middleware');
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
        /*this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());*/
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
        this.adapter.log.info('oauthAuth: ' + JSON.stringify(req.query || {}));
        let redirect_uri = req.query.redirect_uri || '';
        redirect_uri += redirect_uri && redirect_uri.indexOf('?') >= 0 ? '&' : '?';
        redirect_uri += 'state=' + (req.query.state || '');

        let error = false;
        if (req.query.client_id !== this.adapter.config.oauth_client_id) {
            error = 'unauthorized_client';
        } else if (req.query.response_type !== 'code') {
            error = 'unsupported_response_type';
        } else if (req.query.scope !== 'iobroker') {
            error = 'invalid_scope';
        } else if (req.query.response_mode !== 'query') {
            error = 'unsupported_response_mode';
        } else if (!req.query.state) {
            error = 'missing_state';
        }

        if (error) {
            this.adapter.log.warn('Alexa OAuth Error: ' + error);
            redirect_uri += '&error=' + error;
            res
                .status(302)
                .set({
                    'Content-Type': 'text/html; charset=utf-8',
                    'Location': redirect_uri
                })
                .send('<a href="' + redirect_uri + '">Back to Amazon</a><br>Error: ' + error);
        } else {
            const code = uuid();
            this.adapter.log.info('Alexa OAuth Code: ' + code);
            // @TODO store code
            redirect_uri += '&code=' + code;
            res
                .status(200)
                .set({'Content-Type': 'text/html; charset=utf-8'})
                .send('<a href="' + redirect_uri + '">Login via ioBroker</a>');
        }
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
