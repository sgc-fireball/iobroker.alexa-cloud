import https from "https";
import { v4 as uuid } from "uuid";

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

export const alexaSmartHome = async (event, context, callback = null) => {
    const id = context?.awsRequestId || uuid();
    let response = {
        event: {
            header: {
                namespace: 'Alexa',
                name: 'ErrorResponse',
                messageId: uuid(),
                payloadVersion: '3'
            },
            payload: {
                type: 'BRIDGE_UNREACHABLE',
                message: 'Unknown error.'
            }
        }
    };
    try {
        if (!process.env?.IOBROKER_ENDPOINT) {
            throw new Error("Missing environment variable: IOBROKER_ENDPOINT");
        }
        const endpoint = process.env.IOBROKER_ENDPOINT;
        console.info('Request[' + id + ']', JSON.stringify(event))
        //console.debug('Context[' + id + ']', JSON.stringify(context))
        response = JSON.parse(await request(endpoint, JSON.stringify(event)));
    } catch (e) {
        const error = !!e ? (e?.message || e.toString()) : 'Unknown bridge error.';
        console.error('Error[' + id + ']', JSON.stringify(error))
        response.event.payload.message = error;
    }
    console.info('Response[' + id + ']', response)
    if (callback) {
        callback(null, response);
    } else {
        return response;
    }
}
