'use strict';

module.exports = async function (event, context) {
    const uuid = require('uuid');

    let redirect_uri = null;
    let scope = null;
    let response_type = null; // code
    let client_id = null;
    let state = null; // csrf token
    let response_mode = 'query';

    if (event.queryStringParameters) {
        scope = event.queryStringParameters.scope || null;
        response_type = event.queryStringParameters.response_type || null;
        client_id = event.queryStringParameters.client_id || null;
        redirect_uri = event.queryStringParameters.redirect_uri || null;
        state = event.queryStringParameters.state || null;
        response_mode = event.queryStringParameters.response_mode || 'query';
    }

    redirect_uri += redirect_uri && redirect_uri.indexOf('?') >= 0 ? '' : '?';
    redirect_uri += '&state=' + state;

    let error = false;
    if (client_id !== process.env.smarthome_skill_id) {
        error = 'unauthorized_client';
    } else if (response_type !== 'code') {
        error = 'unsupported_response_type';
    } else if (scope !== 'iobroker') {
        error = 'invalid_scope';
    } else if (response_mode !== 'query') {
        error = 'unsupported_response_mode';
    } else if (!state) {
        error = 'missing_state';
    }

    if (error) {
        redirect_uri += '&error=' + error;
        return {
            statusCode: 302,
            headers: {
                'Location': redirect_uri,
                'Content-Type': 'text/html; charset=utf-8'
            },
            body: '<a href="' + redirect_uri + '">Click here</a>'
        };
    }

    redirect_uri += '&code=' + uuid.v4();
    return {
        statusCode: 200,
        headers: {'Content-Type': 'text/html; charset=utf-8'},
        body: '<a href="' + redirect_uri + '">Login via ioBroker</a>'
    };
};
