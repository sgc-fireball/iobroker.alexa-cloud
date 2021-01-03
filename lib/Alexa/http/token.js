'use strict';

module.exports = async function (event, context) {
    const uuid = require('uuid').v4;
    const jwt = require('jsonwebtoken');

    let request = {};
    if (!!event.body) {
        event.body.split('&').forEach((line) => {
            let kv = line.split('=');
            request[kv[0]] = kv[1];
        });
    }

    let code = request.code || null;
    let grant_type = request.grant_type || null;
    let client_id = request.client_id || null;
    let client_secret = request.client_secret || null;
    let refresh_token = request.refresh_token || null;

    if (grant_type !== 'authorization_code' && grant_type !== 'refresh_token') {
        return {statusCode: 401, body: 'invalid grant_type.'};
    } else if (client_id !== process.env.oauth_client_id) {
        return {statusCode: 401, body: 'invalid client_id.'};
    } else if (client_secret !== process.env.oauth_client_secret) {
        return {statusCode: 401, body: 'invalid client_secret.'};
    }

    let id = null;
    if (grant_type === 'authorization_code') {
        if (!!code) {
            // @TODO check the code from authorize request!
            id = uuid();
        } else {
            return {statusCode: 401, body: 'Missing code on grant_type authorization_code.'};
        }
    }
    if (grant_type === 'refresh_token') {
        if (!!refresh_token) {
            if (!jwt.verify(event.directive.payload.scope.token, process.env.oauth_client_secret)) {
                return {statusCode: 401, body: 'Invalid refresh_token.'};
            }
            const token = jwt.decode(event.directive.payload.scope.token);
            if (token.type !== 'refresh_token') {
                return {statusCode: 401, body: 'Invalid refresh_token.'};
            }
            id = token.id;
        } else {
            return {statusCode: 401, body: 'Missing code on grant_type refresh_token.'};
        }
    }

    if (id === null) {
        return {statusCode: 401, body: 'Login failed!'};
    }

    let expires_in = 24 * 60 * 60;
    let response = {
        access_token: jwt.sign({id: id, type: 'access_token'}, process.env.oauth_client_secret, {expiresIn: expires_in}),
        token_type: 'bearer',
        expires_in: expires_in,
        refresh_token: jwt.sign({id: id, type: 'refresh_token'}, process.env.oauth_client_secret),
        scope: 'iobroker',
    };
    return {
        statusCode: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(response)
    };
};
