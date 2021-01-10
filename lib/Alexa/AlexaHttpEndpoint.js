'use strict';

const express = require('express');
const uuid = require('uuid').v4;
//const verifier = require('alexa-verifier-middleware');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const AlexaUtils = require('./AlexaUtils');

class AlexaHttpEndpoint {

    constructor(adapter, bridge) {
        this.adapter = adapter;
        this.bridge = bridge;

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
        this.app.post('/iobroker/alexa-cloud/smarthome', (req, res, next) => {
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
            // @TODO Show login form

            // @TODO if login successful
            const code = uuid();
            // @TODO store code
            redirect_uri += '&code=' + code;
            res
                .status(302)
                .set({
                    'Content-Type': 'text/html; charset=utf-8',
                    'Location': redirect_uri
                })
                .send('<a href="' + redirect_uri + '">Login via ioBroker</a>');
            /*res
                .status(200)
                .set({'Content-Type': 'text/html; charset=utf-8'})
                .send('<a href="' + redirect_uri + '">Login via ioBroker</a>');*/
        }
    }

    oauthToken(req, res, next) {
        if (req.body.client_id !== this.adapter.config.oauth_client_id || req.body.client_secret !== this.adapter.config.oauth_secret) {
            res.status(401).send('invalid client');
            return;
        }

        let tokenId = null;
        if (req.body.grant_type === 'authorization_code') {
            /*if (req.body.code !== code) { // @TODO
                res.status(401).send('invalid code.');
            }*/
            this.adapter.log.info('AlexaHttpEndpoint.oauthToken successful auth.');
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
            this.adapter.log.info('AlexaHttpEndpoint.oauthToken refresh auth.');
            tokenId = token.id;
        } else {
            res.status(401).send('invalid grant_type.');
            return;
        }

        let expiresIn = 3600; // 1 hour
        res
            .status(200)
            .set({
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store',
                'Pragma': 'no-store',
            })
            .send(JSON.stringify({
                access_token: jwt.sign({
                    id: tokenId,
                    type: 'access_token'
                }, this.adapter.config.oauth_secret, {expiresIn: expiresIn}),
                token_type: 'bearer',
                expires_in: expiresIn,
                refresh_token: jwt.sign({
                    id: tokenId,
                    type: 'refresh_token'
                }, this.adapter.config.oauth_secret)
            }, null, 2));
    }

    async smarthome(req, res, next) {
        this.bridge.handle(req.body)
            .then((response) => {
                res
                    .status(200)
                    .set({
                        'Content-Type': 'application/json; charset=utf-8',
                        'Cache-Control': 'no-store',
                        'Pragma': 'no-store',
                    })
                    .send(JSON.stringify(response, null, 2));
            })
            .catch((e) => {
                let error = !!e ? e.toString() : 'Unknown error.';
                this.adapter.log.error('ERROR: ' + error);
                res
                    .status(200)
                    .set({
                        'Content-Type': 'application/json; charset=utf-8',
                        'Cache-Control': 'no-store',
                        'Pragma': 'no-store',
                    })
                    .send(AlexaUtils.eventError({}, {}, 'INTERNAL_ERROR', error));
            });
    }

    unload() {
        this.server && this.server.close();
    }

}

module.exports = AlexaHttpEndpoint;
