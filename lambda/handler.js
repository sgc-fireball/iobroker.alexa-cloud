const https = require('https');
const uuid = require('uuid').v4;

const request = function (domain, body) {
    body = body || '{"error": "missing body"}';
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            protocol: 'https:',
            hostname: domain.replace(/https?:\/\//, ''),
            path: '/iobroker/alexa-cloud/smarthome',
            headers: {
                'Connection': 'Close',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body, 'utf-8')
            }
        };

        const request = https.request(options, (response) => {
            if (response.statusCode !== 200) {
                reject('Invalid Status: ' + response.statusCode);
                return;
            }
            let chunks = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                chunks += chunk;
            });
            response.on('end', () => {
                resolve(chunks);
            });
        });
        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

module.exports.alexaSmartHome = async (event, context, callback) => {
    try {
        let response = await request(
            process.env.iobroker_endpoint,
            JSON.stringify(event, null, 2)
        );
        callback(null, JSON.parse(response));
    } catch (e) {
        const error = !!e ? e.toString() : 'Unknown bridge error.';
        console.error('ERROR: ' + error);
        callback(null, {
            event: {
                header: {
                    namespace: 'Alexa',
                    name: 'ErrorResponse',
                    messageId: uuid(),
                    payloadVersion: '3'
                },
                payload: {
                    type: 'BRIDGE_UNREACHABLE',
                    message: error
                }
            }
        });
    }
};
