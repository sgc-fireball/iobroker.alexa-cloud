'use strict';

const express = require('express');
const uuid = require('uuid').v4;
//const verifier = require('alexa-verifier-middleware');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

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
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());
        this.app.disable('x-powered-by');
        this.app.disable('etag');
        this.app.disable('server');
        //this.app.use('/iobroker/alexa-cloud/endpoint', customSkillRouter);
        this.app.get('/iobroker/alexa-cloud/auth', (req, res, next) => {
            return this.oauthAuth(req, res, next);
        });
        this.app.post('/iobroker/alexa-cloud/token', (req, res, next) => {
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
        let redirect_uri = req.query.redirect_uri || '';
        redirect_uri += redirect_uri && redirect_uri.indexOf('?') >= 0 ? '&' : '?';
        redirect_uri += 'state=' + (req.query.state || '');

        let error = false;
        if (!(redirect_uri.startsWith('https://pitangui.amazon.com/api/skill/link/') || redirect_uri.startsWith('https://alexa.amazon.co.jp/api/skill/link/') || redirect_uri.startsWith('https://layla.amazon.com/api/skill/link/'))) {
            error = 'invalid_redirect_uri';
        } else if (req.query.client_id !== this.adapter.config.oauth_client_id) {
            error = 'unauthorized_client';
        } else if (req.query.response_type !== 'code') {
            error = 'unsupported_response_type';
        } else if (req.query.scope !== 'iobroker') {
            error = 'invalid_scope';
        } else if (!req.query.state) {
            error = 'missing_state';
        }

        if (error) {
            this.adapter.log.warn('AlexaHttpEndpoint.oauthAuth.error: ' + error);
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
        // code=5fb45c31-c786-4272-874b-48e119212679

        if (req.body.client_id !== this.adapter.config.oauth_client_id || req.body.client_secret !== this.adapter.config.oauth_secret) {
            res.status(401).send('invalid client');
            return;
        }

        let tokenId = null;
        if (req.body.grant_type === 'authorization_code') {
            /*if (req.body.code !== code) { // @TODO
                res.status(401).send('invalid code.');
            }*/
            tokenId = uuid();
        } else if (req.body.grant_type === 'refresh_token') {
            if (!jwt.verify(req.body.refresh_token, this.adapter.config.oauth_secret)) {
                res.status(401).send('invalid refresh_token (1).');
                return;
            }
            const token = jwt.decode(req.body.refresh_token);
            if (token.type !== 'refresh_token') {
                res.status(401).send('invalid refresh_token (2).');
                return;
            }
            tokenId = token.id;
        } else {
            res.status(401).send('invalid grant_type.');
            return;
        }

        let expires_in = 24 * 60 * 60;
        res
            .status(200)
            .set({'Content-Type': 'application/json; charset=utf-8'})
            .send(JSON.stringify({
                access_token: jwt.sign({id: tokenId, type: 'access_token'}, this.adapter.config.oauth_secret, {expiresIn: expires_in}),
                token_type: 'bearer',
                expires_in: expires_in,
                refresh_token: jwt.sign({id: tokenId, type: 'refresh_token'}, this.adapter.config.oauth_secret, {expiresIn: expires_in * 30}),
                scope: 'iobroker',
            }, null, 2));
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
