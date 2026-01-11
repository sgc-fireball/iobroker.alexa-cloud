const path = require('path');
const express = require('express');
const { createServer } = require('node:http');
const uuid = require('uuid').v4;
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const AlexaUtils = require('./AlexaUtils');
const AlexaHandles = require('./AlexaHandles');
const { Server } = require('socket.io');
const { spawn } = require('node:child_process');

class AlexaBridge {

    constructor(adapter, adapterUtils) {
        this.adapter = adapter;
        this.adapterUtils = adapterUtils;
        this.alexaHandles = new AlexaHandles(this.adapter, adapterUtils);
        this.cameraState = {};

        /** @see http://expressjs.com/en/guide/behind-proxies.html **/
        this.app = express();
        this.app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());
        this.app.disable('x-powered-by');
        this.app.disable('etag');
        this.app.disable('server');
        this.app.get('/iobroker/alexa-cloud/auth', (req, res, next) => {
            return this._httpOAuthAuth(req, res, next);
        });
        this.app.post('/iobroker/alexa-cloud/token', (req, res, next) => {
            return this._httpOAuthToken(req, res, next);
        });
        this.app.get('/iobroker/alexa-cloud/snapshots/:stream', async (req, res, next) => {
            return this._httpRtspSnapshot(req, res, next);
        });
        this.app.get('/iobroker/alexa-cloud/streams/:stream', (req, res, next) => {
            return this._httpRtspProxy(req, res, next);
        });
        this.app.post('/iobroker/alexa-cloud/smarthome', (req, res, next) => {
            return this._lambdaEndpoint(req, res, next);
        });
        this.app.get('/', (req, res, next) => {
            return res.status(200).send('OK!');
        });

        this.httpServer = createServer(this.app);
        this.io = new Server(this.httpServer);
        this.io.on("connection", socket => {
            let existingSocket = this.activeSockets.find(
                existingSocket => existingSocket === socket.id
            );
            if (!existingSocket) {
                console.log("");
                this.adapter.log.info('Socket.io - Socket connected: ' + socket.id.toString());
                this.activeSockets.push(socket.id);
                socket.on("disconnect", () => {
                    this.adapter.log.info('Socket.io - Socket disconnected: ' + socket.id.toString());
                    this.activeSockets = this.activeSockets.filter(
                        existingSocket => existingSocket !== socket.id
                    );
                });
                existingSocket = socket
            }
        });

        this.server = this.app.listen(this.adapter.config.port, () => {
            this.adapter.log.info('Webserver started on port: ' + this.server.address().port);
        });
    }

    proActiveEvent(json) {
        /**
         * @see https://developer.amazon.com/en-US/docs/alexa/smarthome/authenticate-a-customer-permissions.html
         */
        return this.refreshAccessToken()
            .then((access_token) => {
                json.event.endpoint.scope = { type: 'BearerToken', token: access_token };
                const content = JSON.stringify(json);
                return this.adapterUtils.postJSON('https://api.eu.amazonalexa.com/v3/events', json, {
                    'Authorization': 'Bearer ' + access_token,
                    'Connection': 'Close',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(content, 'utf-8')
                });
            })
            .then(() => {
                this.adapter.setState('info.connection', true, true);
            })
            .catch(e => {
                this.adapter.log.warn('Alexa.Bridge.proActiveEvent: Could not send event. ' + (!!e ? e.toString() : ''));
            });
    }

    refreshAccessToken() {
        return new Promise((resolve, reject) => {
            this.adapter.getState('info.refresh_token', (err, refresh_token) => {
                refresh_token = (refresh_token || {}).val;
                if (!refresh_token) {
                    return reject('Missing account linking.');
                }

                this.adapter.getState('info.expires_at', (err, expires_at) => {
                    expires_at = (expires_at || {}).val || 0;
                    expires_at = parseInt(expires_at);
                    if (expires_at > Date.now()) {
                        this.adapter.getState('info.access_token', (err, access_token) => {
                            resolve(access_token.val);
                        });
                        return;
                    }

                    this.adapter.log.info('Try to receive a new access token by refresh token.')
                    this.adapterUtils.postForm('https://api.amazon.com/auth/o2/token', {
                        grant_type: 'refresh_token',
                        refresh_token: refresh_token,
                        client_id: this.adapter.config.alexa_client_id,
                        client_secret: this.adapter.config.alexa_client_secret
                    })
                        .then(body => {
                            const json = JSON.parse(body);
                            this.adapter.setState('info.token_type', json.token_type, true);
                            this.adapter.setState('info.access_token', json.access_token, true);
                            this.adapter.setState('info.refresh_token', json.refresh_token, true);
                            this.adapter.setState('info.expires_at', Math.floor(Date.now() + ((json.expires_in - 60) * 1000)).toString(), true);
                            this.adapter.setState('info.connection', true, true);
                            resolve(json.access_token);
                        })
                        .catch((e) => {
                            this.adapter.setState('info.connection', false, true);
                            reject(e);
                        });

                });
            });
        });
    }

    _httpOAuthAuth(req, res, next) {
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
            this.adapter.log.warn('AlexaHttpEndpoint._httpOAuthAuth.error: ' + error);
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
        }
    }

    _httpOAuthToken(req, res, next) {
        if (req.body.client_id !== this.adapter.config.oauth_client_id || req.body.client_secret !== this.adapter.config.oauth_client_secret) {
            res.status(401).send('invalid client');
            return;
        }

        let tokenId = null;
        if (req.body.grant_type === 'authorization_code') {
            /*if (req.body.code !== code) { // @TODO
                res.status(401).send('invalid code.');
            }*/
            this.adapter.log.info('AlexaHttpEndpoint._httpOAuthToken successful auth.');
            tokenId = uuid();
        } else if (req.body.grant_type === 'refresh_token') {
            if (!jwt.verify(req.body.refresh_token, this.adapter.config.oauth_client_secret)) {
                res.status(401).send('invalid refresh_token (1).');
                return;
            }
            const token = jwt.decode(req.body.refresh_token);
            if (token.type !== 'refresh_token') {
                res.status(401).send('invalid refresh_token (2).');
                return;
            }
            this.adapter.log.info('AlexaHttpEndpoint._httpOAuthToken refresh auth.');
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
                }, this.adapter.config.oauth_client_secret, { expiresIn: expiresIn }),
                token_type: 'bearer',
                expires_in: expiresIn,
                refresh_token: jwt.sign({
                    id: tokenId,
                    type: 'refresh_token'
                }, this.adapter.config.oauth_client_secret)
            }, null, 2));
    }

    async _httpRtspSnapshot(req, res, next) {
        try {
            jwt.verify(req.query.token || '', this.adapter.config.oauth_client_secret);
        } catch (e) {
            return res.status(401).send('invalid access token.');
        }

        let camera = req.params?.stream?.toString() || 'unknown';
        const deviceId = this.adapterUtils.getNamespace() + '.onvif.' + camera
        const endpointId = this.adapterUtils.normalizeDeviceId('onvif:' + deviceId);
        const device = this.adapter.getSupportedDevices(endpointId)
        if (device === null) {
            this.adapter.log.warn('Could not found camera: ' + endpointId)
            return res.status(404).end();
        }

        const snapshotUrl = await device.getSnapshotUrl();
        if (!snapshotUrl || !snapshotUrl.startsWith('http')) {
            this.adapter.log.warn('Camera not supported snapshots: ' + device.getEndpointId())
            return res.status(404).end();
        }

        this.adapter.log.info('Camera snapshot access ' + device.getEndpointId());
        try {
            const fetchResponse = await fetch(snapshotUrl);
            fetchResponse.body.pipe(res);
        } catch (e) {
            this.adapter.log.warn('Could not fetch image: ' + device.getEndpointId())
            this.adapter.log.warn('Could not fetch image: ' + e.toString())
            return res.status(500).end();
        }
    }

    async _httpRtspProxy(req, res, next) {
        try {
            jwt.verify(req.query.token || '', this.adapter.config.oauth_client_secret);
        } catch (e) {
            return res.status(401).send('invalid access token.');
        }

        let camera = req.params?.stream?.toString() || 'unknown';
        const deviceId = this.adapterUtils.getNamespace() + '.onvif.' + camera
        const endpointId = this.adapterUtils.normalizeDeviceId('onvif:' + deviceId);
        const device = this.adapter.getSupportedDevices(endpointId)
        if (device === null) {
            this.adapter.log.warn('Could not found camera: ' + endpointId)
            return res.status(404).end();
        }

        this.cameraState[endpointId] = this.cameraState[endpointId] || {
            running: false,
            totalLength: 0,
            ffmpeg: null,
            ffmpegTimer: null
        }

        this.adapter.log.info('Camera stream access ' + device.getEndpointId());
        const range = req.headers.range;
        if (range) {
            if (!this.cameraState[endpointId].running) {
                res.end();
                return;
            }
            const start = 0;
            const end = Math.max(this.cameraState[endpointId].totalLength, 1024 * 1024 * 32);
            const chunk_size = end + 1;
            res.writeHead(206, {
                'Accept-Ranges': 'bytes',
                'Content-Range': 'bytes ' + start + '-' + end + '/' + chunk_size,
                'Content-length': chunk_size,
                'Content-Type': 'video/mp4',
                'Connection': 'keep-alive'
            });
            this.cameraState[endpointId].ffmpeg.stdout.unpipe();
            this.cameraState[endpointId].ffmpeg.stdout.pipe(res);
            return;
        } else {
            res.writeHead(200, {
                'Accept-Ranges': 'bytes',
                'Content-Type': 'video/mp4',
                'Connection': 'keep-alive'
            });
        }

        if (this.cameraState[endpointId].running) {
            if (this.cameraState[endpointId].ffmpeg) {
                this.cameraState[endpointId].ffmpeg.kill("SIGINT");
            }
            this.cameraState[endpointId].totalLength = 0;
            if (this.cameraState[endpointId].ffmpegTimer) {
                clearTimeout(this.cameraState[endpointId].ffmpegTimer);
                this.cameraState[endpointId].ffmpegTimer = null;
            }
        }

        this.cameraState[endpointId].ffmpeg = spawn("ffmpeg", [
            "-i", await device.getStreamUrl(),
            "-f", "mp4",       // File format
            "-movflags", "empty_moov+frag_keyframe",
            "-c", "copy",      // No transcoding
            "-t", "60",        // Timeout
            "-"                // Output (to stdout)
        ]);

        res.end();
        this.cameraState[endpointId].running = true;
        this.cameraState[endpointId].ffmpeg.stdout.on('data', () => {
        });
        this.cameraState[endpointId].ffmpegTimer = setTimeout(function () {
            this.cameraState[endpointId].ffmpeg.kill("SIGINT");
            this.cameraState[endpointId].ffmpegTimer = null;
            this.cameraState[endpointId].running = false;
            delete this.cameraState[endpointId];
        }, 60_000);
    }

    _lambdaEndpoint(req, res, next) {
        this.alexaHandles.handle(req)
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
                this.adapter.log.warn('ERROR: ' + error);
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

module.exports = AlexaBridge;
