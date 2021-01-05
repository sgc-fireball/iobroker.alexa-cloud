const https = require('https');

const request = function (domain, body) {
    body = body || {err: "missing body"};
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            protocol: 'https:',
            hostname: domain.replace(/https?:\/\//, ''),
            path: '/iobroker/alexa-cloud/smarthome',
            headers: {
                'Connection': 'Close',
                'Content-Type': 'application/json',
                'Content-Length': body.length
            }
        };

        const request = https.request(options, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject('Invalid Status: ' + response.statusCode);
                return;
            }
            let chunks = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                chunks += chunk;
            });
            response.on('end', () => {
                try {
                    console.log('HTTP Status: ' + response.statusCode);
                    console.log(chunks);
                    resolve([response.statusCode, chunks]);
                } catch (err) {
                    console.error('ERROR: ' + JSON.stringify(err));
                    reject(err);
                }
            });
        });
        request.on('error', (err) => {
            console.error('ERROR: ' + JSON.stringify(err));
            reject(err);
        });
        if (body) {
            request.write(body);
        }
        request.end();
    });
}

module.exports.alexaSmartHome = async (event, context) => {
    let code, content;
    [code, content] = await request(process.env.iobroker_endpoint, JSON.stringify(event, null, 2));
    return {statusCode: code, body: content};
};
