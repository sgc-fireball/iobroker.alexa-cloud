# iobroker.alexa-cloud

## Roadmap
### Mailstone One
The first milestone is to develop a standalone adapter that does not
require another cloud system. However, iobroker is to be released for
the Internet so that Amazon's servers can reach your instances.

ATTENTION: It is strongly recommended not to release ioBroker with the
complete ioBroker with all adapters. If this should be done anyway,
please provide all other security relevant content with an
Auth Basic password protection or even release it exclusively to
certain IP addresses!

### Mailstone Two
The second milestone is to develop an Amazon Lambda function with
IoT Core Cloud and an Authication Adapter that acts as a reverse proxy
to your iobroker instances, like the "iobroker.iot" adapter.

This will also allow those who do not have the ability or means
to build their own reverse proxy to use this adapter.

## Setup
### Security Profile / Login with Amazon
- https://developer.amazon.com/settings/console/securityprofile/create-security-profile.html
- https://developer.amazon.com/settings/console/securityprofile/web-settings/update.html

### developer.amazon.com
Create an Smart Home Skill under https://developer.amazon.com/alexa/console/ask

#### Smart Home
- Payload version: v3
- Smart Home service endpoint
    - Default endpoint: `none`
- Account Linking
    - Security Provider Information
        - Auth Code Grant: `Yes`
            - Your Web Authorization URI: `https://iobroker.your.dyndns.com/iobroker/alexa-cloud/auth`
            - Access Token URI: `https://iobroker.your.dyndns.com/iobroker/alexa-cloud/token`
            - Your Client ID: `amzn1.ask.skill.XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
            - Your Secret: `secret`
            - Your Authentication Scheme: `Credentials in request body`
            - Scope: `iobroker`
            - Domain List: `iobroker.your.dyndns.com`
- Permissions
    - Send Alexa Events: `On`

Follow the next steps from [Lambda Readme.md](./lambda/readme.md)

## Uninstall
```bash
cd lambda
sls remove
```

## Tests
- https://www.jsonschemavalidator.net/
- https://raw.githubusercontent.com/alexa/alexa-smarthome/master/validation_schemas/alexa_smart_home_message_schema.json

## Sources
- https://developer.amazon.com/de-DE/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html
- https://developer.amazon.com/de-DE/docs/alexa/account-linking/configure-authorization-code-grant.html
- https://developer.amazon.com/de-DE/docs/alexa/account-linking/requirements-account-linking.html#access-token-uri-requirements
- https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-authorization.html
- https://developer.amazon.com/en-US/docs/alexa/smarthome/get-started-with-device-templates.html#plug

## TODO
- https://developer.amazon.com/de-DE/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html
- https://github.com/AlCalzone/release-script
- https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/develop-your-first-skill.html
